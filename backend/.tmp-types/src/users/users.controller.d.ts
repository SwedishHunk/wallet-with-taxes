import { UsersService } from "./users.service";
import { Request } from "express";
import { LinkWalletDto, LoginDto, SignupDto } from "./dto/users-request.dto";
import { UserProfileDto } from "./dto/users-response.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    signup(body: SignupDto): Promise<{
        token: string;
        studio: {
            studioId: string;
            studioName: string;
        };
        member: {
            memberId: string;
            userId: string;
            studioId: string;
            email: string;
            isOwner: boolean;
            permissions: string[];
            gameAccessIds: string[];
        };
    }>;
    login(body: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            walletAddress: string;
            custodyMode: "custodial" | "self";
            kycStatus: "pending" | "verified" | "rejected";
            studioId: string;
            isAdmin: boolean;
        };
    }>;
    linkWallet(req: Request, body: LinkWalletDto): Promise<{
        message: string;
    }>;
    getProfile(req: Request): Promise<UserProfileDto | null>;
    getStudios(req: Request): Promise<{
        role: import("../platform/entities/studio-member.entity").StudioRole;
        id: string;
        name: string;
        email: string;
        members: import("../platform/entities/studio-member.entity").StudioMember[];
        studioUsers: import("../platform/entities/studio-user.entity").StudioUser[];
        walletAddress?: string;
        status: "active" | "suspended";
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getMemberSession(req: Request, studioId: string): Promise<{
        memberId: string;
        userId: string;
        studioId: string;
        email: string;
        isOwner: boolean;
        role: import("../platform/entities/studio-member.entity").StudioRole;
        permissions: string[];
        gameAccessIds: string[];
    }>;
}
