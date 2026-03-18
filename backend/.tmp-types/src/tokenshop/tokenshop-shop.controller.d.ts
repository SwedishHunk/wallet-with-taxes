import { TokenShopQueryService } from "./tokenshop-query.service";
export declare class TokenShopShopController {
    private readonly tokenShopQueryService;
    constructor(tokenShopQueryService: TokenShopQueryService);
    getSupportedAssets(): Promise<{
        address: string;
        symbol: string;
        decimals: number;
        buyRate: string;
        sellRate: string;
    }[]>;
    getConfig(): Promise<{
        shopAddress: string | null;
        tokenAddress: string;
        paused: boolean;
        feeBps: number;
        feePercent: number;
        maxEthIn: string;
        maxGenIn: string;
        rates: {
            eth: {
                buyRate: string;
                sellRate: string;
            };
        };
        valuation: {
            ethUsd: number | null;
            usdSek: number | null;
            source: string;
            snapshotLoadedAt: string;
        };
        genTotalSupply: string;
    }>;
    getLiquidity(): Promise<Record<string, string | number | null>>;
}
