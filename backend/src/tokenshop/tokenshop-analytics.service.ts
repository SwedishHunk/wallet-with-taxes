import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopQueryService } from "./tokenshop-query.service";

@Injectable()
export class TokenShopAnalyticsService {
  constructor(
    @InjectRepository(ShopEvent)
    private readonly shopEventRepo: Repository<ShopEvent>,
    private readonly tokenShopQueryService: TokenShopQueryService,
  ) {}

  async getSummary() {
    const [events, config] = await Promise.all([
      this.shopEventRepo.find(),
      this.tokenShopQueryService.getShopConfig(),
    ]);

    let totalGenMinted = 0n;
    let totalGenBurned = 0n;
    const buyers = new Set<string>();
    const sellers = new Set<string>();
    const users = new Set<string>();

    for (const event of events) {
      users.add(event.user);
      if (event.type === "BUY") {
        buyers.add(event.user);
        totalGenMinted += BigInt(event.amountOut);
      } else {
        sellers.add(event.user);
        totalGenBurned += BigInt(event.amountIn);
      }
    }

    return {
      totalBuys: events.filter((event) => event.type === "BUY").length,
      totalSells: events.filter((event) => event.type === "SELL").length,
      totalGenMinted: this.formatBigInt18(totalGenMinted),
      totalGenBurned: this.formatBigInt18(totalGenBurned),
      genTotalSupply: config.genTotalSupply,
      uniqueBuyers: buyers.size,
      uniqueSellers: sellers.size,
      uniqueUsers: users.size,
    };
  }

  async getPerAsset() {
    const events = await this.shopEventRepo.find({
      order: { createdAt: "DESC", id: "DESC" },
    });

    const assetMap = new Map<
      string,
      {
        asset: string;
        symbol: string;
        buys: number;
        sells: number;
        uniqueBuyers: Set<string>;
        uniqueSellers: Set<string>;
        totalPaidIn: bigint;
        totalPaidOut: bigint;
        totalGenOut: bigint;
        totalGenIn: bigint;
      }
    >();

    for (const event of events) {
      const key = event.asset;
      const current =
        assetMap.get(key) ??
        {
          asset: event.asset,
          symbol: event.assetSymbol || event.asset,
          buys: 0,
          sells: 0,
          uniqueBuyers: new Set<string>(),
          uniqueSellers: new Set<string>(),
          totalPaidIn: 0n,
          totalPaidOut: 0n,
          totalGenOut: 0n,
          totalGenIn: 0n,
        };

      if (event.type === "BUY") {
        current.buys += 1;
        current.uniqueBuyers.add(event.user);
        current.totalPaidIn += BigInt(event.amountIn);
        current.totalGenOut += BigInt(event.amountOut);
      } else {
        current.sells += 1;
        current.uniqueSellers.add(event.user);
        current.totalGenIn += BigInt(event.amountIn);
        current.totalPaidOut += BigInt(event.amountOut);
      }

      assetMap.set(key, current);
    }

    return [...assetMap.values()].map((asset) => ({
      asset: asset.asset,
      symbol: asset.symbol,
      buys: asset.buys,
      sells: asset.sells,
      uniqueBuyers: asset.uniqueBuyers.size,
      uniqueSellers: asset.uniqueSellers.size,
      totalPaidIn: asset.totalPaidIn.toString(),
      totalPaidOut: asset.totalPaidOut.toString(),
      totalGenOut: this.formatBigInt18(asset.totalGenOut),
      totalGenIn: this.formatBigInt18(asset.totalGenIn),
    }));
  }

  async getRecentActivity(limit = 15) {
    const events = await this.shopEventRepo.find({
      order: { blockNumber: "DESC", logIndex: "DESC" },
      take: limit,
    });

    return events.map((event) => ({
      type: event.type,
      block: event.blockNumber,
      txHash: event.txHash,
      user: event.user,
      asset: event.asset,
      assetSymbol: event.assetSymbol,
      amountIn: event.amountIn,
      amountOut: event.amountOut,
      timestamp: event.createdAt,
    }));
  }

  async getUserHistory(userAddress: string) {
    const normalizedUser = userAddress.toLowerCase();
    const events = await this.shopEventRepo.find({
      where: { user: normalizedUser },
      order: { blockNumber: "DESC", logIndex: "DESC" },
    });

    const assetMap = new Map<
      string,
      {
        asset: string;
        symbol: string;
        buys: number;
        sells: number;
        totalPaidIn: bigint;
        totalPaidOut: bigint;
        totalGenOut: bigint;
        totalGenIn: bigint;
      }
    >();

    for (const event of events) {
      const current =
        assetMap.get(event.asset) ??
        {
          asset: event.asset,
          symbol: event.assetSymbol || event.asset,
          buys: 0,
          sells: 0,
          totalPaidIn: 0n,
          totalPaidOut: 0n,
          totalGenOut: 0n,
          totalGenIn: 0n,
        };

      if (event.type === "BUY") {
        current.buys += 1;
        current.totalPaidIn += BigInt(event.amountIn);
        current.totalGenOut += BigInt(event.amountOut);
      } else {
        current.sells += 1;
        current.totalPaidOut += BigInt(event.amountOut);
        current.totalGenIn += BigInt(event.amountIn);
      }

      assetMap.set(event.asset, current);
    }

    return {
      user: normalizedUser,
      positions: [...assetMap.values()].map((asset) => ({
        asset: asset.asset,
        symbol: asset.symbol,
        buys: asset.buys,
        sells: asset.sells,
        totalPaidIn: asset.totalPaidIn.toString(),
        totalPaidOut: asset.totalPaidOut.toString(),
        totalGenOut: this.formatBigInt18(asset.totalGenOut),
        totalGenIn: this.formatBigInt18(asset.totalGenIn),
        netGen: this.formatBigInt18(asset.totalGenOut - asset.totalGenIn),
      })),
      events: events.map((event) => ({
        type: event.type,
        block: event.blockNumber,
        txHash: event.txHash,
        asset: event.asset,
        assetSymbol: event.assetSymbol,
        amountIn: event.amountIn,
        amountOut: event.amountOut,
        timestamp: event.createdAt,
      })),
    };
  }

  private formatBigInt18(value: bigint) {
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const stringValue = absolute.toString();
    const padded = stringValue.padStart(19, "0");
    const integerPart = padded.slice(0, -18) || "0";
    const decimalPart = padded.slice(-18).replace(/0+$/, "");
    const formatted = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
    return negative ? `-${formatted}` : formatted;
  }
}
