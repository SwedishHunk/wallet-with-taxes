import { TokenShopAnalyticsService } from "./tokenshop-analytics.service";
export declare class TokenShopAnalyticsController {
    private readonly tokenShopAnalyticsService;
    constructor(tokenShopAnalyticsService: TokenShopAnalyticsService);
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
    getActivity(limit?: string): Promise<{
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
}
