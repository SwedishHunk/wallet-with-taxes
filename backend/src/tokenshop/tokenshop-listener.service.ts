import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Contract,
  ethers,
  JsonRpcProvider,
  Log,
  WebSocketProvider,
} from "ethers";
import { DataSource, Repository } from "typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { ShopEvent } from "./entities/shop-event.entity";
import { TOKENSHOP_ABI } from "./tokenshop.abi";
import { TokenShopSyncState } from "./entities/tokenshop-sync-state.entity";

type TokenShopEventName = "Bought" | "Sold";

type ParsedTokenShopEvent = {
  name: TokenShopEventName;
  userAddress: string;
  payAsset: string;
  amountInRaw: bigint;
  triAmountRaw: bigint;
  txHash: string;
  logIndex: number;
  blockNumber: number;
};

@Injectable()
export class TokenShopListenerService implements OnModuleInit, OnModuleDestroy {
  private static readonly SYNC_STATE_ID = "tokenshop";
  private readonly logger = new Logger(TokenShopListenerService.name);
  private readonly pollIntervalMs = Number(
    process.env.TOKENSHOP_POLL_INTERVAL_MS ?? "2000",
  );
  private readonly rpcUrl = process.env.RPC_URL?.trim();
  private readonly tokenShopAddress = process.env.TOKENSHOP_ADDRESS?.trim();
  private readonly provider = this.rpcUrl
    ? new JsonRpcProvider(this.rpcUrl)
    : null;
  private readonly contract =
    this.provider && this.tokenShopAddress
      ? new Contract(this.tokenShopAddress, TOKENSHOP_ABI, this.provider)
      : null;
  private readonly interface = new ethers.Interface(TOKENSHOP_ABI);
  private readonly ethAddress = ethers.ZeroAddress.toLowerCase();
  private readonly ethUsdSnapshot = this.parsePositiveNumber(
    process.env.TOKENSHOP_ETH_USD,
  );
  // Timestamp of when this process loaded the env-var snapshot.
  // Operators should compare this against the current time to judge staleness.
  private readonly ethUsdSnapshotAt = new Date();

  private timer: NodeJS.Timeout | null = null;
  private syncInProgress = false;
  private usingWebSocket = false;
  private wsProvider: WebSocketProvider | null = null;
  private wsContract: Contract | null = null;
  private readonly wsRpcUrl = process.env.WS_RPC_URL?.trim();
  private triTokenAddress: string | null = process.env.TRI_TOKEN_ADDRESS?.trim()
    ? process.env.TRI_TOKEN_ADDRESS.trim().toLowerCase()
    : null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TaxEvent)
    private readonly taxEventRepo: Repository<TaxEvent>,
    @InjectRepository(ShopEvent)
    private readonly shopEventRepo: Repository<ShopEvent>,
    @InjectRepository(TokenShopSyncState)
    private readonly syncStateRepo: Repository<TokenShopSyncState>,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (this.ethUsdSnapshot !== null) {
      this.logger.warn(
        `ETH/USD price snapshot loaded from env: $${this.ethUsdSnapshot} ` +
          `(set at process start ${this.ethUsdSnapshotAt.toISOString()}). ` +
          `Update TOKENSHOP_ETH_USD and restart to refresh.`,
      );
    } else {
      this.logger.warn(
        "TOKENSHOP_ETH_USD is not set — USD-denominated tax events will have no priceUSD.",
      );
    }

    if (!this.provider || !this.contract || !this.tokenShopAddress) {
      this.logger.log(
        "TokenShop listener disabled: missing TOKENSHOP_ADDRESS or RPC_URL",
      );
      return;
    }

    try {
      if (!this.triTokenAddress) {
        const tokenAddress = (await this.contract.token()) as string;
        this.triTokenAddress = tokenAddress.toLowerCase();
      }
    } catch (error) {
      this.logger.warn(
        `TokenShop listener could not resolve TRI token address: ${this.formatError(error)}`,
      );
    }

    // Catch up on any missed blocks first
    void this.syncOnce();

    // Try WebSocket for real-time events, fall back to polling
    if (this.wsRpcUrl) {
      try {
        await this.startWebSocket();
      } catch (error) {
        this.logger.warn(
          `WebSocket connection failed, falling back to polling: ${this.formatError(error)}`,
        );
        this.schedule();
      }
    } else {
      this.logger.log("No WS_RPC_URL configured — using polling mode");
      this.schedule();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.wsContract) {
      void this.wsContract.removeAllListeners();
      this.wsContract = null;
    }
    if (this.wsProvider) {
      void this.wsProvider.destroy();
      this.wsProvider = null;
    }
    this.usingWebSocket = false;
  }

  /**
   * Start real-time WebSocket event subscriptions.
   * Falls back to polling if the WS connection drops.
   */
  private async startWebSocket() {
    if (!this.wsRpcUrl || !this.tokenShopAddress) return;

    this.wsProvider = new WebSocketProvider(this.wsRpcUrl);
    this.wsContract = new Contract(
      this.tokenShopAddress,
      TOKENSHOP_ABI,
      this.wsProvider,
    );

    // Subscribe to Bought and Sold events in real-time
    await this.wsContract.on("Bought", (...args: unknown[]) => {
      const event = args[args.length - 1] as { log: Log };
      void this.handleWebSocketEvent(event.log);
    });
    await this.wsContract.on("Sold", (...args: unknown[]) => {
      const event = args[args.length - 1] as { log: Log };
      void this.handleWebSocketEvent(event.log);
    });

    // Handle disconnection: fall back to polling
    void this.wsProvider.on("error", () => {
      this.logger.warn("WebSocket error — falling back to polling");
      this.usingWebSocket = false;
      this.wsContract = null;
      this.wsProvider = null;
      this.schedule();
    });

    this.usingWebSocket = true;
    this.logger.log(
      `WebSocket connected to ${this.wsRpcUrl} — real-time event subscriptions active`,
    );
  }

  /**
   * Handle an individual event received via WebSocket subscription.
   * Parses the log and persists it, then updates the sync state.
   */
  private async handleWebSocketEvent(log: Log) {
    const parsed = this.parseLog(log);
    if (!parsed) return;

    try {
      await this.persistParsedEvent(parsed);

      // Update sync state so polling catch-up knows where we left off
      const syncState = await this.getOrCreateSyncState();
      const currentBlock = Number(syncState.lastSyncedBlock);
      if (log.blockNumber > currentBlock) {
        syncState.lastSyncedBlock = String(log.blockNumber);
        await this.syncStateRepo.save(syncState);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process WebSocket event: ${this.formatError(error)}`,
      );
    }
  }

  private schedule() {
    this.timer = setTimeout(() => {
      void this.syncOnce().finally(() => this.schedule());
    }, this.pollIntervalMs);
  }

  async syncNow() {
    await this.syncOnce();
    const syncState = await this.getOrCreateSyncState();

    return {
      status: "ok",
      lastSyncedBlock: Number(syncState.lastSyncedBlock),
    };
  }

  async reindexFromGenesis() {
    const syncState = await this.getOrCreateSyncState();
    syncState.lastSyncedBlock = "0";
    await this.syncStateRepo.save(syncState);
    await this.syncOnce();
    const updated = await this.getOrCreateSyncState();
    return {
      status: "ok",
      lastSyncedBlock: Number(updated.lastSyncedBlock),
    };
  }

  private async syncOnce() {
    if (!this.provider || !this.contract) {
      return;
    }
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      const latestBlock = await this.provider.getBlockNumber();
      const syncState = await this.getOrCreateSyncState();
      let fromBlock = Number(syncState.lastSyncedBlock) + 1;

      // Detect chain restart (e.g. Anvil wiped): DB says we synced past the
      // current chain tip. Reset to 0 so all events are re-indexed.
      if (Number(syncState.lastSyncedBlock) > latestBlock) {
        this.logger.warn(
          `Chain reset detected (lastSynced=${syncState.lastSyncedBlock}, ` +
            `latest=${latestBlock}). Clearing stale events and re-indexing from block 0.`,
        );
        await this.shopEventRepo.clear();
        await this.taxEventRepo.clear();
        syncState.lastSyncedBlock = "0";
        await this.syncStateRepo.save(syncState);
        fromBlock = 1;
      }

      if (fromBlock > latestBlock) {
        return;
      }

      const boughtLogs = await this.contract.queryFilter(
        this.contract.filters.Bought(),
        fromBlock,
        latestBlock,
      );
      const soldLogs = await this.contract.queryFilter(
        this.contract.filters.Sold(),
        fromBlock,
        latestBlock,
      );

      for (const log of [...boughtLogs, ...soldLogs]) {
        const parsed = this.parseLog(log);
        if (!parsed) {
          continue;
        }
        await this.persistParsedEvent(parsed);
      }

      syncState.lastSyncedBlock = String(latestBlock);
      await this.syncStateRepo.save(syncState);
    } catch (error) {
      this.logger.error(`TokenShop sync failed: ${this.formatError(error)}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async getOrCreateSyncState() {
    let state = await this.syncStateRepo.findOne({
      where: { id: TokenShopListenerService.SYNC_STATE_ID },
    });

    if (!state) {
      state = this.syncStateRepo.create({
        id: TokenShopListenerService.SYNC_STATE_ID,
        lastSyncedBlock: "0",
      });
      state = await this.syncStateRepo.save(state);
    }

    return state;
  }

  private parseLog(log: Log): ParsedTokenShopEvent | null {
    try {
      const parsed = this.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });

      if (!parsed || (parsed.name !== "Bought" && parsed.name !== "Sold")) {
        return null;
      }

      const userAddress = String(parsed.args.user).toLowerCase();
      const payAsset = String(parsed.args.payAsset).toLowerCase();
      const amountInRaw =
        parsed.name === "Bought"
          ? (parsed.args.amountIn as bigint)
          : (parsed.args.amountOut as bigint);
      const triAmountRaw =
        parsed.name === "Bought"
          ? (parsed.args.genOut as bigint)
          : (parsed.args.genIn as bigint);

      return {
        name: parsed.name,
        userAddress,
        payAsset,
        amountInRaw,
        triAmountRaw,
        txHash: log.transactionHash,
        logIndex: log.index,
        blockNumber: log.blockNumber,
      };
    } catch {
      return null;
    }
  }

  private async persistParsedEvent(event: ParsedTokenShopEvent) {
    const triAmount = Number(ethers.formatUnits(event.triAmountRaw, 18));
    if (!Number.isFinite(triAmount) || triAmount <= 0) {
      return;
    }

    const paymentAmount = this.normalizePaymentAmount(
      event.payAsset,
      event.amountInRaw,
    );
    const estimatedUnitPriceUsd = this.estimateUnitPriceUsd(
      event.payAsset,
      paymentAmount,
      triAmount,
    );
    const normalizedAssetAddress = (
      this.triTokenAddress ?? "TRI"
    ).toLowerCase();
    const normalizedPayAsset = event.payAsset.toLowerCase();
    const taxType = event.name === "Bought" ? "acquisition" : "disposal";
    const shopEventType = event.name === "Bought" ? "BUY" : "SELL";

    await this.dataSource.transaction(async (manager) => {
      const transactionalTaxRepo = manager.getRepository(TaxEvent);
      const transactionalShopEventRepo = manager.getRepository(ShopEvent);

      const existingTaxEvent = await transactionalTaxRepo.findOne({
        where: {
          source: "tokenshop",
          txHash: event.txHash,
          logIndex: event.logIndex,
        },
      });
      if (existingTaxEvent) {
        return;
      }

      const existingShopEvent = await transactionalShopEventRepo.findOne({
        where: {
          txHash: event.txHash,
          logIndex: event.logIndex,
        },
      });
      if (existingShopEvent) {
        return;
      }

      await transactionalShopEventRepo.save(
        transactionalShopEventRepo.create({
          type: shopEventType,
          blockNumber: event.blockNumber,
          txHash: event.txHash,
          logIndex: event.logIndex,
          user: event.userAddress,
          asset: normalizedPayAsset,
          assetSymbol:
            normalizedPayAsset === this.ethAddress ? "ETH" : normalizedPayAsset,
          amountIn:
            event.name === "Bought"
              ? event.amountInRaw.toString()
              : event.triAmountRaw.toString(),
          amountOut:
            event.name === "Bought"
              ? event.triAmountRaw.toString()
              : event.amountInRaw.toString(),
        }),
      );

      await transactionalTaxRepo.save(
        transactionalTaxRepo.create({
          type: taxType,
          userAddress: event.userAddress,
          assetAddress: normalizedAssetAddress,
          tokenId: 0,
          amount: triAmount,
          feeUSD: 0,
          priceUSD:
            estimatedUnitPriceUsd !== null &&
            Number.isFinite(estimatedUnitPriceUsd)
              ? estimatedUnitPriceUsd
              : undefined,
          source: "tokenshop",
          txHash: event.txHash,
          logIndex: event.logIndex,
        }),
      );
    });
  }

  private normalizePaymentAmount(
    payAsset: string,
    amountRaw: bigint,
  ): number | null {
    try {
      if (payAsset === this.ethAddress) {
        return Number(ethers.formatEther(amountRaw));
      }

      // Placeholder assumption for MVP decimals only; fiat valuation is withheld
      // unless a reliable valuation source is configured.
      return Number(ethers.formatUnits(amountRaw, 18));
    } catch {
      return null;
    }
  }

  private estimateUnitPriceUsd(
    payAsset: string,
    paymentAmount: number | null,
    triAmount: number,
  ) {
    if (
      payAsset !== this.ethAddress ||
      paymentAmount === null ||
      !this.ethUsdSnapshot ||
      !Number.isFinite(paymentAmount) ||
      !Number.isFinite(triAmount) ||
      triAmount <= 0
    ) {
      return null;
    }

    return (paymentAmount * this.ethUsdSnapshot) / triAmount;
  }

  private parsePositiveNumber(value?: string) {
    if (!value?.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
