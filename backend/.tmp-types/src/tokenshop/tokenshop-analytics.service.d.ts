import { Repository } from "typeorm";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopQueryService } from "./tokenshop-query.service";
export declare class TokenShopAnalyticsService {
    private readonly shopEventRepo;
    private readonly tokenShopQueryService;
    constructor(shopEventRepo: Repository<ShopEvent>, tokenShopQueryService: TokenShopQueryService);
    getSummary(): Promise<{
        totalBuys: number;
        totalSells: number;
        totalGenMinted: string;
        totalGenBurned: string;
        genTotalSupply: string;
        uniqueBuyers: number;
        uniqueSellers: number;
        uniqueUsers: number;
    }>;
    getPerAsset(): Promise<{
        asset: string;
        symbol: string;
        buys: number;
        sells: number;
        uniqueBuyers: number;
        uniqueSellers: number;
        totalPaidIn: string;
        totalPaidOut: string;
        totalGenOut: string;
        totalGenIn: string;
    }[]>;
    getRecentActivity(limit?: number): Promise<{
        type: "BUY" | "SELL";
        block: number;
        txHash: string;
        user: string;
        asset: string;
        assetSymbol: string;
        amountIn: string;
        amountOut: string;
        timestamp: Date;
    }[]>;
    getUserHistory(userAddress: string): Promise<{
        user: string;
        positions: {
            asset: string;
            symbol: string;
            buys: number;
            sells: number;
            totalPaidIn: string;
            totalPaidOut: string;
            totalGenOut: string;
            totalGenIn: string;
            netGen: string;
        }[];
        events: {
            type: "BUY" | "SELL";
            block: number;
            txHash: string;
            asset: string;
            assetSymbol: string;
            amountIn: string;
            amountOut: string;
            timestamp: Date;
        }[];
    }>;
    private formatBigInt18;
}
