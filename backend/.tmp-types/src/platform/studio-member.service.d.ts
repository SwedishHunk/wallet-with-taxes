import { Repository, EntityManager } from "typeorm";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Studio } from "./entities/studio.entity";
import { User } from "../users/user.entity";
export interface CreateMemberDto {
    userId: string;
    role?: StudioRole;
    permissionsMask?: bigint;
    gameAccessIds?: string[];
}
export interface UpdateMemberDto {
    role?: StudioRole;
    permissionsMask?: bigint;
    gameAccessIds?: string[];
}
export declare class StudioMemberService {
    private readonly memberRepository;
    private readonly studioRepository;
    constructor(memberRepository: Repository<StudioMember>, studioRepository: Repository<Studio>);
    private assertIsOwner;
    private assertCanManageMembers;
    private assertSameStudio;
    private assertTargetNotOwner;
    private assertNotLastOwner;
    getStudioOwners(studioId: string): Promise<StudioMember[]>;
    getStudioMembers(studioId: string): Promise<StudioMember[]>;
    getMemberById(memberId: string): Promise<StudioMember>;
    hasPermission(member: StudioMember, permission: bigint): boolean;
    hasGameAccess(member: StudioMember, gameId: string): boolean;
    createMember(actorId: string, studioId: string, dto: CreateMemberDto): Promise<StudioMember>;
    updateMember(actorId: string, memberId: string, dto: UpdateMemberDto): Promise<StudioMember>;
    deleteMember(actorId: string, memberId: string): Promise<void>;
    promoteToOwner(actorId: string, memberId: string): Promise<StudioMember>;
    createBootstrapOwner(studio: Studio, user: User, manager?: EntityManager): Promise<StudioMember>;
    maskToFlags(mask: bigint): Record<string, boolean>;
    flagsToMask(flags: Record<string, boolean>): bigint;
    maskToPermissionStrings(mask: bigint): string[];
}
