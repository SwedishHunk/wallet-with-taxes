export interface UserProfileDto {
    id: string;
    email: string;
    walletAddress: string;
    custodyMode: "custodial" | "self";
    kycStatus: "pending" | "verified" | "rejected";
    createdAt: Date;
    updatedAt: Date;
    onChainWallet: string | null;
    isAdmin: boolean;
    isSuspended: boolean;
    studioId: string | null;
}
