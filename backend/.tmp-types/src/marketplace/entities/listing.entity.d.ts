export declare class Listing {
    id: number;
    sellerId: number;
    tokenAddress: string;
    tokenId: number;
    amount: number;
    pricePerUnit: number;
    status: "active" | "sold" | "cancelled";
    createdAt: Date;
    updatedAt: Date;
}
