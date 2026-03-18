import { TokenShopQueryService } from "./tokenshop-query.service";
export declare class TokenShopQuotesController {
    private readonly tokenShopQueryService;
    constructor(tokenShopQueryService: TokenShopQueryService);
    getBuyEthQuote(amount?: string): Promise<{
        asset: string;
        amountIn: string;
        genOut: string;
        note: string;
    }>;
    getSellEthQuote(gen?: string): Promise<{
        asset: string;
        genIn: string;
        amountOut: string;
        note: string;
    }>;
    getBuyTokenQuote(asset?: string, amount?: string): Promise<{
        asset: string;
        symbol: string;
        amountIn: string;
        genOut: string;
        note: string;
    }>;
    getSellTokenQuote(asset?: string, gen?: string): Promise<{
        asset: string;
        symbol: string;
        genIn: string;
        amountOut: string;
        note: string;
    }>;
}
