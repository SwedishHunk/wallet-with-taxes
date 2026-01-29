// Studio-relaterade frontend types

export interface Studio {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioWithMembers extends Studio {
  memberCount: number;
  ownerCount: number;
  currentMemberIsOwner?: boolean;
}
