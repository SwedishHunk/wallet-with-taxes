import { StudioMember } from "./studio-member.entity";
import { StudioUser } from "./studio-user.entity";
export declare class Studio {
    id: string;
    name: string;
    email: string;
    members: StudioMember[];
    studioUsers: StudioUser[];
    walletAddress?: string;
    status: "active" | "suspended";
    createdAt: Date;
    updatedAt: Date;
}
