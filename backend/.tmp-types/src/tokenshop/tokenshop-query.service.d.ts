import { Repository } from "typeorm";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopChainService } from "./tokenshop-chain.service";
export declare class TokenShopQueryService {
    private readonly chainService;
    private readonly shopEventRepo;
    private readonly ethUsdSnapshotAt;
    constructor(chainService: TokenShopChainService, shopEventRepo: Repository<ShopEvent>);
    getShopConfig(): Promise<{
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
    getShopLiquidity(): Promise<Record<string, string | number | null>>;
    getSupportedAssets(): Promise<{
        address: string;
        symbol: string;
        decimals: number;
        buyRate: string;
        sellRate: string;
    }[]>;
    quoteBuyEth(amount: string): Promise<{
        asset: string;
        amountIn: string;
        genOut: string;
        note: string;
    }>;
    quoteSellEth(gen: string): Promise<{
        asset: string;
        genIn: string;
        amountOut: string;
        note: string;
    }>;
    quoteBuyToken(asset: string, amount: string): Promise<{
        asset: string;
        symbol: string;
        amountIn: string;
        genOut: string;
        note: string;
    }>;
    quoteSellToken(asset: string, gen: string): Promise<{
        asset: string;
        symbol: string;
        genIn: string;
        amountOut: string;
        note: string;
    }>;
    getUserBalance(userAddress: string): Promise<{
        user: string;
        tokenAddress: string;
        genBalance: string;
    }>;
    private getTokenSupply;
    private parseEnvNumber;
}
