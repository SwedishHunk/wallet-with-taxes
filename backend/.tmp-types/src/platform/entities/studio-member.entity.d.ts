import { User } from "../../users/user.entity";
import { Studio } from "./studio.entity";
export declare enum StudioRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member"
}
export declare const PermissionBitMask: {
    readonly ManageMembers: 1n;
    readonly ManageGames: 2n;
    readonly ManageSettings: 4n;
    readonly MintNFT: 8n;
    readonly MakeTransactions: 16n;
};
export type PermissionBitMask = bigint;
export declare class StudioMember {
    id: string;
    studio: Studio;
    user: User;
    isOwner: boolean;
    role: StudioRole;
    permissionsMask: bigint;
    gameAccessIds: string[];
    createdAt: Date;
    updatedAt: Date;
}
