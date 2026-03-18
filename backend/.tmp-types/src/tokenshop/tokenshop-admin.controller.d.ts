import { TokenShopAdminService } from "./tokenshop-admin.service";
type SetRatesBody = {
    asset?: string;
    buyRate?: string;
    sellRate?: string;
};
type SetFeeBody = {
    feeBps?: number;
};
type SetLimitsBody = {
    maxEthIn?: string;
    maxGenIn?: string;
};
type WithdrawEthBody = {
    to?: string;
    amountWei?: string;
};
type SetSupportedTokenBody = {
    asset?: string;
    supported?: boolean;
};
type SetAssetDecimalsBody = {
    asset?: string;
    decimals?: number;
};
export declare class TokenShopAdminController {
    private readonly tokenShopAdminService;
    constructor(tokenShopAdminService: TokenShopAdminService);
    setRates(body: SetRatesBody): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    setFee(body: SetFeeBody): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    pause(): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    unpause(): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    setLimits(body: SetLimitsBody): {
        txs: Record<string, unknown>[];
    };
    withdrawEth(body: WithdrawEthBody): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    setSupportedToken(body: SetSupportedTokenBody): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
    setAssetDecimals(body: SetAssetDecimalsBody): {
        tx: {
            to: string | null;
            data: string;
            description: string;
        };
    };
}
export {};
