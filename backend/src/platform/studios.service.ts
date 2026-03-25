import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Studio } from "./entities/studio.entity";
import { User } from "../users/user.entity";
import { StudioMemberService } from "./studio-member.service";
import * as bcrypt from "bcryptjs";
import { ethers } from "ethers";
import { KeyManagementService } from "../shared/key-management.service";
import * as crypto from "crypto";
import { assertValidEmail } from "../shared/validators/email.validator";

export interface CreateMemberRequestDto {
  email: string;
  password?: string;
  role?: string;
  permissions: string[];
}

export interface UpdateMemberRequestDto {
  role?: string;
  permissions: string[];
}

@Injectable()
export class StudiosService {
  constructor(
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudioMember)
    private readonly memberRepository: Repository<StudioMember>,
    private readonly studioMemberService: StudioMemberService,
    private readonly keyManagement: KeyManagementService,
  ) {}

  /**
   * Get all members in a studio (with authorization)
   */
  async getStudioMembers(studioId: string, actorId: string): Promise<any[]> {
    // Verify actor is member of this studio
    const actor = await this.memberRepository.findOne({
      where: { user: { id: actorId }, studio: { id: studioId } },
      relations: ["user", "studio"],
    });

    if (!actor) {
      throw new ForbiddenException("Not a member of this studio.");
    }

    // Get all members
    const members = await this.memberRepository.find({
      where: { studio: { id: studioId } },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      isOwner: m.isOwner,
      role: m.role,
      permissions: this.studioMemberService.maskToPermissionStrings(
        m.permissionsMask,
      ),
      gameAccessIds: m.gameAccessIds ?? [],
      createdAt: m.createdAt,
    }));
  }

  /**
   * Create a new member in a studio
   *
   * Authorization: actor must have ManageMembers or be Owner
   *
   * Creates:
   * 1. User (if doesn't exist)
   * 2. Membership in studio
   *
   * Returns: created member info
   */
  async createMember(
    studioId: string,
    actorId: string,
    dto: CreateMemberRequestDto,
  ): Promise<any> {
    // Verify actor has ManageMembers permission
    const actor = await this.memberRepository.findOne({
      where: { user: { id: actorId }, studio: { id: studioId } },
      relations: ["user", "studio"],
    });

    if (!actor) {
      throw new ForbiddenException("Not a member of this studio.");
    }

    // Check permission
    const canManage =
      actor.isOwner ||
      this.studioMemberService.hasPermission(
        actor,
        BigInt(1), // ManageMembers = 1n
      );

    if (!canManage) {
      throw new ForbiddenException(
        "Insufficient permissions to manage members.",
      );
    }

    assertValidEmail(dto.email);

    // Get or create user
    let user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      // Create new user with password or temp password
      const password = dto.password || this.generateTempPassword();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const wallet = ethers.Wallet.createRandom();

      const encryptedPrivateKey = await this.keyManagement.encrypt(
        wallet.privateKey,
      );

      user = this.userRepository.create({
        email: dto.email,
        passwordHash,
        custodyMode: "custodial",
        encryptedPrivateKey,
        walletAddress: wallet.address,
        kycStatus: "pending",
      });

      await this.userRepository.save(user);
    }

    // Check if user is already a member of this studio
    const existing = await this.memberRepository.findOne({
      where: { studio: { id: studioId }, user: { id: user.id } },
    });

    if (existing) {
      throw new BadRequestException("User is already a member of this studio.");
    }

    // Create membership
    const studio = await this.studioRepository.findOne({
      where: { id: studioId },
    });

    if (!studio) {
      throw new NotFoundException("Studio not found.");
    }

    // Convert permissions to mask
    const mask = this.permissionsToMask(dto.permissions ?? []);

    const member = this.memberRepository.create({
      studio,
      user,
      isOwner: false,
      role: dto.role ? (dto.role as StudioRole) : StudioRole.MEMBER,
      permissionsMask: mask,
      gameAccessIds: [],
    });

    const saved = await this.memberRepository.save(member);

    return {
      id: saved.id,
      userId: saved.user.id,
      email: saved.user.email,
      isOwner: saved.isOwner,
      role: saved.role,
      permissions: this.studioMemberService.maskToPermissionStrings(
        saved.permissionsMask,
      ),
      gameAccessIds: saved.gameAccessIds ?? [],
    };
  }

  async updateMember(
    studioId: string,
    actorId: string,
    memberId: string,
    dto: UpdateMemberRequestDto,
  ): Promise<any> {
    const actor = await this.memberRepository.findOne({
      where: { user: { id: actorId }, studio: { id: studioId } },
      relations: ["user", "studio"],
    });

    if (!actor) {
      throw new ForbiddenException("Not a member of this studio.");
    }

    const target = await this.memberRepository.findOne({
      where: { id: memberId },
      relations: ["user", "studio"],
    });

    if (!target || target.studio.id !== studioId) {
      throw new NotFoundException("Member not found.");
    }

    const updated = await this.studioMemberService.updateMember(
      actor.id,
      memberId,
      {
        role: dto.role ? (dto.role as StudioRole) : undefined,
        permissionsMask: this.permissionsToMask(dto.permissions ?? []),
      },
    );

    const reloaded =
      updated.user && updated.studio
        ? updated
        : await this.memberRepository.findOne({
            where: { id: updated.id },
            relations: ["user", "studio"],
          });

    if (!reloaded) {
      throw new NotFoundException("Member not found after update.");
    }

    return {
      id: reloaded.id,
      userId: reloaded.user.id,
      email: reloaded.user.email,
      isOwner: reloaded.isOwner,
      role: reloaded.role,
      permissions: this.studioMemberService.maskToPermissionStrings(
        reloaded.permissionsMask,
      ),
      gameAccessIds: reloaded.gameAccessIds ?? [],
      createdAt: reloaded.createdAt,
    };
  }

  async deleteMember(
    studioId: string,
    actorId: string,
    memberId: string,
  ): Promise<{ success: true }> {
    const actor = await this.memberRepository.findOne({
      where: { user: { id: actorId }, studio: { id: studioId } },
      relations: ["user", "studio"],
    });

    if (!actor) {
      throw new ForbiddenException("Not a member of this studio.");
    }

    const target = await this.memberRepository.findOne({
      where: { id: memberId },
      relations: ["studio"],
    });

    if (!target || target.studio.id !== studioId) {
      throw new NotFoundException("Member not found.");
    }

    await this.studioMemberService.deleteMember(actor.id, memberId);
    return { success: true };
  }

  private generateTempPassword(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private permissionsToMask(permissions: string[]): bigint {
    const permMap: Record<string, bigint> = {
      ManageMembers: 1n,
      ManageGames: 2n,
      ManageSettings: 4n,
      MintNFT: 8n,
      MakeTransactions: 16n,
    };

    let mask = 0n;
    for (const perm of permissions) {
      if (permMap[perm]) {
        mask |= permMap[perm];
      }
    }
    return mask;
  }
}
