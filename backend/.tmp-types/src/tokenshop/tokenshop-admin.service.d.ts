import { TokenShopChainService } from "./tokenshop-chain.service";
export declare class TokenShopAdminService {
    private readonly chainService;
    constructor(chainService: TokenShopChainService);
    buildUnsignedTx(functionName: string, args: unknown[]): {
        to: string | null;
        data: string;
        description: string;
    };
}
