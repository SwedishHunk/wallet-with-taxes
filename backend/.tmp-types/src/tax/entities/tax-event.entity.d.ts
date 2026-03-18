export declare class TaxEvent {
    id: number;
    type: "trade" | "mint" | "withdraw" | "reward" | "acquisition" | "disposal";
    userAddress: string;
    assetAddress: string;
    tokenId: number;
    amount: number;
    feeUSD: number;
    timestamp: Date;
    priceUSD?: number;
    source?: string | null;
    txHash?: string | null;
    logIndex?: number | null;
}
