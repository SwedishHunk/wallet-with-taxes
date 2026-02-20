export interface User {
  id: string;
  email: string;
  walletAddress: string;
  custodyMode: "custodial" | "self";
  kycStatus: "pending" | "verified" | "rejected";
  isAdmin: boolean;
  onChainWallet?: string;
  studioId?: string | null;
  createdAt: string;
}

/** Personal account user (logged into a personal account within a game/studio context) */
export interface PersonalUser {
  id: string;
  email: string;
  role: string;
  accessPoints: Record<string, boolean>;
}
