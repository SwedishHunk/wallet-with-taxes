import { StudioMember } from "../platform/entities/studio-member.entity";
export declare class User {
    id: string;
    email: string;
    passwordHash: string;
    custodyMode: "custodial" | "self";
    encryptedPrivateKey: string | null;
    walletAddress: string;
    kycStatus: "pending" | "verified" | "rejected";
    createdAt: Date;
    updatedAt: Date;
    onChainWallet: string;
    isAdmin: boolean;
    isSuspended: boolean;
    studioMemberships: StudioMember[];
}
