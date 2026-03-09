import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Contract, ethers, JsonRpcProvider, Log } from "ethers";
import { DataSource, Repository } from "typeorm";
import tokenShopAbi from "../shared/constants/abis/TokenShop.json";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { ShopEvent } from "./entities/shop-event.entity";
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
export class TokenShopListenerService
  implements OnModuleInit, OnModuleDestroy
{
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
      ? new Contract(this.tokenShopAddress, tokenShopAbi, this.provider)
      : null;
  private readonly interface = new ethers.Interface(tokenShopAbi);
  private readonly ethAddress = ethers.ZeroAddress.toLowerCase();

  private timer: NodeJS.Timeout | null = null;
  private syncInProgress = false;
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

    this.schedule();
    void this.syncOnce();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    this.timer = setTimeout(() => {
      void this.syncOnce().finally(() => this.schedule());
    }, this.pollIntervalMs);
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
      const fromBlock = Number(syncState.lastSyncedBlock) + 1;

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
      this.logger.error(
        `TokenShop sync failed: ${this.formatError(error)}`,
      );
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
    const placeholderUnitPrice =
      paymentAmount !== null ? paymentAmount / triAmount : undefined;
    const normalizedAssetAddress = (this.triTokenAddress ?? "TRI").toLowerCase();
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
            placeholderUnitPrice !== undefined &&
            Number.isFinite(placeholderUnitPrice)
              ? placeholderUnitPrice
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

      // Placeholder assumption for MVP: non-ETH payment assets are 18 decimals
      // until a proper valuation/decimals adapter is introduced.
      return Number(ethers.formatUnits(amountRaw, 18));
    } catch {
      return null;
    }
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
