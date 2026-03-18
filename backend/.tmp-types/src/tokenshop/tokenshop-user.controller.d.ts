import { TokenShopAnalyticsService } from "./tokenshop-analytics.service";
import { TokenShopQueryService } from "./tokenshop-query.service";
export declare class TokenShopUserController {
    private readonly tokenShopQueryService;
    private readonly tokenShopAnalyticsService;
    constructor(tokenShopQueryService: TokenShopQueryService, tokenShopAnalyticsService: TokenShopAnalyticsService);
    getBalance(userAddress: string): Promise<{
        user: string;
        tokenAddress: string;
        genBalance: string;
    }>;
    getHistory(userAddress: string): Promise<{
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
}
