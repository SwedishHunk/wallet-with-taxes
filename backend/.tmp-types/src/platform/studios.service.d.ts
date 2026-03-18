import { Repository } from "typeorm";
import { StudioMember } from "./entities/studio-member.entity";
import { Studio } from "./entities/studio.entity";
import { User } from "../users/user.entity";
import { StudioMemberService } from "./studio-member.service";
export interface CreateMemberRequestDto {
    email: string;
    password?: string;
    role?: string;
    permissions: string[];
}
export declare class StudiosService {
    private readonly studioRepository;
    private readonly userRepository;
    private readonly memberRepository;
    private readonly studioMemberService;
    constructor(studioRepository: Repository<Studio>, userRepository: Repository<User>, memberRepository: Repository<StudioMember>, studioMemberService: StudioMemberService);
    getStudioMembers(studioId: string, actorId: string): Promise<any[]>;
    createMember(studioId: string, actorId: string, dto: CreateMemberRequestDto): Promise<any>;
    private generateTempPassword;
    private permissionsToMask;
}
