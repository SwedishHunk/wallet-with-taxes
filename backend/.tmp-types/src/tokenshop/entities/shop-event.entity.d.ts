export declare class ShopEvent {
    id: number;
    type: "BUY" | "SELL";
    blockNumber: number;
    txHash: string;
    logIndex: number;
    user: string;
    asset: string;
    assetSymbol: string;
    amountIn: string;
    amountOut: string;
    createdAt: Date;
}
