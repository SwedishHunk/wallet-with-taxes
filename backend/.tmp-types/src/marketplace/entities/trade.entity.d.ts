export declare class Trade {
    id: number;
    buyerId: number;
    sellerId: number;
    listingId: number;
    amount: number;
    totalPrice: number;
    feeUSD: number;
    status: "pending" | "confirmed" | "failed";
    createdAt: Date;
    updatedAt: Date;
}
