import { Repository, DataSource } from "typeorm";
import { User } from "./user.entity";
import { JwtService } from "@nestjs/jwt";
import { Studio } from "../platform/entities/studio.entity";
import { StudioMember, StudioRole } from "../platform/entities/studio-member.entity";
import { StudioMemberService } from "../platform/studio-member.service";
import { UserProfileDto } from "./dto/users-response.dto";
export declare class UsersService {
    private readonly userRepository;
    private readonly studioRepository;
    private readonly studioMemberRepository;
    private readonly studioMemberService;
    private readonly jwtService;
    private readonly dataSource;
    private readonly logger;
    private readonly deployerPrivateKey;
    constructor(userRepository: Repository<User>, studioRepository: Repository<Studio>, studioMemberRepository: Repository<StudioMember>, studioMemberService: StudioMemberService, jwtService: JwtService, dataSource: DataSource);
    private buildCustodialCredentials;
    private buildLinkWalletMessage;
    private toUserProfileView;
    private tryCreateOnChainWallet;
    signup(email: string, password: string, studioName?: string): Promise<{
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
    login(email: string, password: string, studioId?: string): Promise<{
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
    linkWallet(userId: string, currentPassword: string, walletAddress: string, signature: string): Promise<{
        message: string;
    }>;
    private autoMigrateOrphanUser;
    findById(id: string): Promise<UserProfileDto | null>;
    getStudiosForUser(userId: string): Promise<{
        role: StudioRole;
        id: string;
        name: string;
        email: string;
        members: StudioMember[];
        studioUsers: import("../platform/entities/studio-user.entity").StudioUser[];
        walletAddress?: string;
        status: "active" | "suspended";
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getMemberSession(userId: string, studioId: string): Promise<{
        memberId: string;
        userId: string;
        studioId: string;
        email: string;
        isOwner: boolean;
        role: StudioRole;
        permissions: string[];
        gameAccessIds: string[];
    }>;
}
