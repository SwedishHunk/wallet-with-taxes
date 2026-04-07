import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ethers } from "ethers";
import { TaxService } from "../tax/tax.service";

/** Minimal ABI fragments — only the events we index. */
const MARKETPLACE_ABI = [
  "event Sold(address indexed seller, address indexed buyer, address indexed assetAddress, uint256 tokenId, uint256 price, uint256 fee)",
];

const TRI_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

/**
 * ChainIndexerService — subscribes to on-chain events and writes TaxEvents.
 *
 * GATED: only runs when CHAIN_INDEXER_ENABLED=true AND WS_RPC_URL is set.
 * Designed for a single-instance deployment; for multi-instance, replace with
 * a queue-based indexer (e.g. BullMQ + Redis) to prevent duplicate processing.
 *
 * Monitored events:
 *   • Marketplace.Sold  → acquisition (buyer) + disposal (seller) TaxEvents
 *   • TRI.Transfer      → acquisition / disposal TaxEvents for TRI holders
 *
 * Auto-reconnects with exponential back-off when the WS connection drops.
 */
@Injectable()
export class ChainIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainIndexerService.name);

  private provider: ethers.WebSocketProvider | null = null;
  private marketplaceContract: ethers.Contract | null = null;
  private triContract: ethers.Contract | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private reconnectDelayMs = 5_000;
  private readonly MAX_RECONNECT_DELAY_MS = 60_000;

  constructor(private readonly taxService: TaxService) {}

  // ── lifecycle ─────────────────────────────────────────────────────────────

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.warn(
        "ChainIndexer is DISABLED. Set CHAIN_INDEXER_ENABLED=true and " +
          "WS_RPC_URL=ws(s)://... to activate on-chain event indexing.",
      );
      return;
    }
    this.logger.log("ChainIndexer starting…");
    void this.connectAndListen();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    void this.disconnect();
  }

  // ── public helper (for manual / test reconnect) ──────────────────────────

  isEnabled(): boolean {
    return (
      process.env.CHAIN_INDEXER_ENABLED === "true" &&
      Boolean(process.env.WS_RPC_URL)
    );
  }

  // ── connection ────────────────────────────────────────────────────────────

  async connectAndListen(): Promise<void> {
    const wsUrl = process.env.WS_RPC_URL!;
    const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
    const triAddr = process.env.TRI_TOKEN_ADDRESS;

    try {
      this.provider = new ethers.WebSocketProvider(wsUrl);

      // Verify connectivity
      await this.provider.getBlockNumber();
      this.reconnectDelayMs = 5_000; // reset on successful connect
      this.logger.log(`ChainIndexer connected to ${wsUrl}`);

      // Wire up WebSocket close handler for auto-reconnect
      const ws = (this.provider as unknown as { websocket: WebSocket })
        .websocket;
      if (ws) {
        ws.addEventListener("close", () => {
          this.logger.warn("WS connection closed — scheduling reconnect");
          this.scheduleReconnect();
        });
      }

      // Subscribe to Marketplace.Sold
      if (marketplaceAddr) {
        this.marketplaceContract = new ethers.Contract(
          marketplaceAddr,
          MARKETPLACE_ABI,
          this.provider,
        );
        void this.marketplaceContract.on(
          "Sold",
          (seller, buyer, assetAddress, tokenId, price, fee, event) => {
            void this.handleMarketplaceSold(
              seller as string,
              buyer as string,
              assetAddress as string,
              tokenId as bigint,
              price as bigint,
              fee as bigint,
              event as ethers.EventLog,
            );
          },
        );
        this.logger.log(`Listening to Marketplace.Sold @ ${marketplaceAddr}`);
      } else {
        this.logger.warn(
          "MARKETPLACE_ADDRESS not set — Marketplace.Sold events will not be indexed.",
        );
      }

      // Subscribe to TRI.Transfer
      if (triAddr) {
        this.triContract = new ethers.Contract(
          triAddr,
          TRI_TRANSFER_ABI,
          this.provider,
        );
        void this.triContract.on("Transfer", (from, to, value, event) => {
          void this.handleTriTransfer(
            from as string,
            to as string,
            value as bigint,
            event as ethers.EventLog,
          );
        });
        this.logger.log(`Listening to TRI.Transfer @ ${triAddr}`);
      } else {
        this.logger.warn(
          "TRI_TOKEN_ADDRESS not set — TRI.Transfer events will not be indexed.",
        );
      }
    } catch (err) {
      this.logger.error(
        `ChainIndexer connection failed: ${String(err instanceof Error ? err.message : err)}`,
      );
      this.scheduleReconnect();
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.marketplaceContract) {
        await this.marketplaceContract.removeAllListeners();
        this.marketplaceContract = null;
      }
      if (this.triContract) {
        await this.triContract.removeAllListeners();
        this.triContract = null;
      }
      if (this.provider) {
        await this.provider.destroy();
        this.provider = null;
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer) return; // already scheduled

    this.logger.log(`Reconnecting in ${this.reconnectDelayMs / 1000}s…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.disconnect().then(() => this.connectAndListen());
    }, this.reconnectDelayMs);

    // Exponential back-off, capped at MAX_RECONNECT_DELAY_MS
    this.reconnectDelayMs = Math.min(
      this.reconnectDelayMs * 2,
      this.MAX_RECONNECT_DELAY_MS,
    );
  }

  // ── event handlers ────────────────────────────────────────────────────────

  private async handleMarketplaceSold(
    seller: string,
    buyer: string,
    assetAddress: string,
    tokenId: bigint,
    price: bigint,
    fee: bigint,
    event: ethers.EventLog,
  ): Promise<void> {
    const priceEth = parseFloat(ethers.formatEther(price));
    const feeEth = parseFloat(ethers.formatEther(fee));
    const timestamp = await this.getBlockTimestamp(event.blockNumber);

    // Seller: disposal of the NFT
    await this.taxService.logEvent({
      type: "disposal",
      userAddress: seller.toLowerCase(),
      assetAddress: assetAddress.toLowerCase(),
      tokenId: Number(tokenId),
      amount: 1,
      priceUSD: priceEth, // priceEth used as proxy; real impl needs USD oracle
      feeUSD: feeEth,
      txHash: event.transactionHash,
      timestamp,
    });

    // Buyer: acquisition of the NFT
    await this.taxService.logEvent({
      type: "acquisition",
      userAddress: buyer.toLowerCase(),
      assetAddress: assetAddress.toLowerCase(),
      tokenId: Number(tokenId),
      amount: 1,
      priceUSD: priceEth,
      feeUSD: 0,
      txHash: event.transactionHash,
      timestamp,
    });

    // Buyer: disposal of TRI used to pay for the NFT.
    // When the buyer pays in TRI, spending TRI is itself a taxable disposal
    // event — the buyer must report any gain/loss vs their TRI cost basis.
    // We log the TRI disposal here so the buyer's tax report is complete.
    const triAddr = process.env.TRI_TOKEN_ADDRESS;
    if (triAddr) {
      await this.taxService.logEvent({
        type: "disposal",
        userAddress: buyer.toLowerCase(),
        assetAddress: triAddr.toLowerCase(),
        tokenId: 0, // TRI is ERC-20 — no per-token ID; 0 by convention
        amount: priceEth, // quantity of TRI tokens spent (using ETH unit as proxy)
        priceUSD: priceEth, // total USD value of TRI spent
        feeUSD: feeEth,
        txHash: event.transactionHash,
        timestamp,
      });
    }

    this.logger.debug(
      `Indexed Marketplace.Sold: seller=${seller} buyer=${buyer} asset=${assetAddress} tokenId=${tokenId}`,
    );
  }

  private async handleTriTransfer(
    from: string,
    to: string,
    value: bigint,
    event: ethers.EventLog,
  ): Promise<void> {
    // Skip mint (from=0x000) and burn (to=0x000) events
    const ZERO = "0x0000000000000000000000000000000000000000";
    if (from === ZERO || to === ZERO) return;

    const amount = parseFloat(ethers.formatEther(value));
    const timestamp = await this.getBlockTimestamp(event.blockNumber);

    await this.taxService.logEvent({
      type: "disposal",
      userAddress: from.toLowerCase(),
      assetAddress: (process.env.TRI_TOKEN_ADDRESS ?? "").toLowerCase(),
      tokenId: 0, // TRI is ERC-20 — no per-token ID; 0 by convention
      feeUSD: 0,
      amount,
      txHash: event.transactionHash,
      timestamp,
    });

    await this.taxService.logEvent({
      type: "acquisition",
      userAddress: to.toLowerCase(),
      assetAddress: (process.env.TRI_TOKEN_ADDRESS ?? "").toLowerCase(),
      tokenId: 0, // TRI is ERC-20 — no per-token ID; 0 by convention
      feeUSD: 0,
      amount,
      txHash: event.transactionHash,
      timestamp,
    });

    this.logger.debug(
      `Indexed TRI.Transfer: from=${from} to=${to} amount=${amount}`,
    );
  }

  private async getBlockTimestamp(blockNumber: number): Promise<Date> {
    try {
      const block = await this.provider!.getBlock(blockNumber);
      return block ? new Date(block.timestamp * 1000) : new Date();
    } catch {
      return new Date();
    }
  }
}
