/**
 * StudioMemberService
 *
 * Hanterar all member-administration med strikta Owner-immutability regler
 *
 * INVARIANTS (enforced i denna service):
 * 1. En Studio måste ALLTID ha minst en Owner
 * 2. Owner-members kan aldrig raderas
 * 3. Owner-members kan aldrig få isOwner=false
 * 4. Owner-members kan aldrig få permissions ändrade
 * 5. Owner-members kan aldrig få gameAccess ändrad
 * 6. Endast Owners kan administrera andra members
 * 7. Endast Owners kan promovera nya Owners
 */

import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  StudioMember,
  PermissionBitMask,
  StudioRole,
} from "./entities/studio-member.entity";
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

@Injectable()
export class StudioMemberService {
  constructor(
    @InjectRepository(StudioMember)
    private readonly memberRepository: Repository<StudioMember>,
    @InjectRepository(Studio)
    private readonly studioRepository: Repository<Studio>,
  ) {}

  // ============ HELPERS ============

  /**
   * Kontrollera att actor är Owner
   */
  private assertIsOwner(actor: StudioMember): void {
    if (!actor.isOwner) {
      throw new ForbiddenException("Only Owners can perform this action.");
    }
  }

  /**
   * Kontrollera att actor kan administrera members
   * Policy:
   * - Owner kan administrera alla (utom andra Owners)
   * - ManageMembers permission räcker för icke-Owner members
   */
  private assertCanManageMembers(actor: StudioMember): void {
    const canManage =
      actor.isOwner ||
      this.hasPermission(actor, PermissionBitMask.ManageMembers);

    if (!canManage) {
      throw new ForbiddenException(
        "Insufficient permissions to manage members. Need Owner status or ManageMembers permission.",
      );
    }
  }

  /**
   * Kontrollera att actor och target är från samma studio
   */
  private assertSameStudio(actor: StudioMember, target: StudioMember): void {
    if (actor.studio.id !== target.studio.id) {
      throw new ForbiddenException(
        "Cannot manage members from different studios.",
      );
    }
  }

  /**
   * Kontrollera att target inte är Owner (skyddsregel)
   * Owner är immun och kan inte modifieras av någon, inte ens annan Owner
   */
  private assertTargetNotOwner(target: StudioMember): void {
    if (target.isOwner) {
      throw new ForbiddenException(
        "Cannot modify Owner members. Owner status is immutable.",
      );
    }
  }

  /**
   * Kontrollera att operationen inte lämnar studion utan Owners
   */
  private async assertNotLastOwner(
    studioId: string,
    targetMemberId?: string,
  ): Promise<void> {
    const query = this.memberRepository
      .createQueryBuilder("member")
      .where("member.studio_id = :studioId", { studioId })
      .andWhere("member.is_owner = :isOwner", { isOwner: true });

    if (targetMemberId) {
      query.andWhere("member.id != :targetMemberId", { targetMemberId });
    }

    const ownerCount = await query.getCount();

    if (ownerCount === 0) {
      throw new BadRequestException(
        "Studio must have at least one Owner. Cannot proceed with this operation.",
      );
    }
  }

  /**
   * Hämta alla Owners för en studio
   */
  async getStudioOwners(studioId: string): Promise<StudioMember[]> {
    return this.memberRepository.find({
      where: {
        studio: { id: studioId },
        isOwner: true,
      },
    });
  }

  /**
   * Hämta medlemmar för en studio
   */
  async getStudioMembers(studioId: string): Promise<StudioMember[]> {
    return this.memberRepository.find({
      where: { studio: { id: studioId } },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Hämta en medlem by ID
   */
  async getMemberById(memberId: string): Promise<StudioMember> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId },
      relations: ["user", "studio"],
    });

    if (!member) {
      throw new NotFoundException("Member not found.");
    }

    return member;
  }

  /**
   * Check: Har medlem en specifik permission?
   */
  hasPermission(member: StudioMember, permission: bigint): boolean {
    return (member.permissionsMask & permission) !== 0n;
  }

  /**
   * Check: Har medlem tillgång till en specifik game?
   */
  hasGameAccess(member: StudioMember, gameId: string): boolean {
    return member.gameAccessIds.includes(gameId);
  }

  // ============ CRUD OPERATIONS ============

  /**
   * SKAPA en ny medlem
   * - Actor måste ha ManageMembers OR vara Owner
   * - Actor och target måste vara samma studio
   * - Target får inte redan vara medlem
   */
  async createMember(
    actorId: string,
    studioId: string,
    dto: CreateMemberDto,
  ): Promise<StudioMember> {
    // Hämta actor och validera admin-rättigheter
    const actor = await this.memberRepository.findOne({
      where: { id: actorId },
      relations: ["studio"],
    });

    if (!actor) {
      throw new NotFoundException("Actor member not found.");
    }

    this.assertCanManageMembers(actor);

    if (actor.studio.id !== studioId) {
      throw new ForbiddenException(
        "Cannot manage members in different studios.",
      );
    }

    // Hämta studio
    const studio = await this.studioRepository.findOne({
      where: { id: studioId },
    });

    if (!studio) {
      throw new NotFoundException("Studio not found.");
    }

    // Kontrollera att user redan är medlem
    const existing = await this.memberRepository.findOne({
      where: {
        studio: { id: studioId },
        user: { id: dto.userId },
      },
    });

    if (existing) {
      throw new BadRequestException("User is already a member of this studio.");
    }

    // Skapa medlem
    const member = this.memberRepository.create({
      studio,
      user: { id: dto.userId } as User,
      isOwner: false, // Kan aldrig skapas som Owner
      role: dto.role || StudioRole.MEMBER,
      permissionsMask: dto.permissionsMask ?? 0n,
      gameAccessIds: dto.gameAccessIds ?? [],
    });

    return this.memberRepository.save(member);
  }

  /**
   * UPPDATERA en medlems permissions/game-access
   * - Actor måste ha ManageMembers OR vara Owner
   * - Target får inte vara Owner (Owner är immutable)
   */
  async updateMember(
    actorId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<StudioMember> {
    const actor = await this.memberRepository.findOne({
      where: { id: actorId },
    });

    if (!actor) {
      throw new NotFoundException("Actor member not found.");
    }

    this.assertCanManageMembers(actor);

    const target = await this.memberRepository.findOne({
      where: { id: memberId },
    });

    if (!target) {
      throw new NotFoundException("Target member not found.");
    }

    this.assertSameStudio(actor, target);
    this.assertTargetNotOwner(target); // Skydda Owners

    // Uppdatera fields
    if (dto.role !== undefined) {
      target.role = dto.role;
    }

    if (dto.permissionsMask !== undefined) {
      target.permissionsMask = dto.permissionsMask;
    }

    if (dto.gameAccessIds !== undefined) {
      target.gameAccessIds = dto.gameAccessIds;
    }

    return this.memberRepository.save(target);
  }

  /**
   * RADERA en medlem
   * - Actor måste ha ManageMembers OR vara Owner
   * - Target får inte vara Owner
   * - Studio måste behålla minst en Owner
   */
  async deleteMember(actorId: string, memberId: string): Promise<void> {
    const actor = await this.memberRepository.findOne({
      where: { id: actorId },
    });

    if (!actor) {
      throw new NotFoundException("Actor member not found.");
    }

    this.assertCanManageMembers(actor);

    const target = await this.memberRepository.findOne({
      where: { id: memberId },
    });

    if (!target) {
      throw new NotFoundException("Target member not found.");
    }

    this.assertSameStudio(actor, target);
    this.assertTargetNotOwner(target);

    // Försäkra att det finns minst en annan Owner kvar
    await this.assertNotLastOwner(target.studio.id, memberId);

    // Radera
    await this.memberRepository.remove(target);
  }

  /**
   * PROMOVERA medlem till Owner
   * - ENDAST Owners kan promovera nya Owners (strict requirement)
   * - Target får inte redan vara Owner
   * - Target och actor måste vara samma studio
   */
  async promoteToOwner(
    actorId: string,
    memberId: string,
  ): Promise<StudioMember> {
    const actor = await this.memberRepository.findOne({
      where: { id: actorId },
    });

    if (!actor) {
      throw new NotFoundException("Actor member not found.");
    }

    // STRICT: Only Owners can promote to Owner
    this.assertIsOwner(actor);

    const target = await this.memberRepository.findOne({
      where: { id: memberId },
    });

    if (!target) {
      throw new NotFoundException("Target member not found.");
    }

    this.assertSameStudio(actor, target);

    if (target.isOwner) {
      throw new BadRequestException("Member is already an Owner.");
    }

    // Promovera till Owner
    target.isOwner = true;
    target.role = StudioRole.OWNER;

    // Ge alla permissions
    target.permissionsMask =
      PermissionBitMask.ManageMembers |
      PermissionBitMask.ManageGames |
      PermissionBitMask.ManageSettings |
      PermissionBitMask.MintNFT |
      PermissionBitMask.MakeTransactions;

    return this.memberRepository.save(target);
  }

  // ============ BOOTSTRAP (setup on studio creation) ============

  /**
   * BOOTSTRAP: Skapa första Owner-medlemmen när studio skapas
   * Denna medlem auto-aktiveras (kommer att sparas i session)
   * Returnerar den nyskapade Owner-medlemmen
   */
  async createBootstrapOwner(
    studio: Studio,
    user: User,
  ): Promise<StudioMember> {
    const owner = this.memberRepository.create({
      studio,
      user,
      isOwner: true,
      role: StudioRole.OWNER,
      permissionsMask:
        PermissionBitMask.ManageMembers |
        PermissionBitMask.ManageGames |
        PermissionBitMask.ManageSettings |
        PermissionBitMask.MintNFT |
        PermissionBitMask.MakeTransactions,
      gameAccessIds: [], // Games läggs till senare
    });

    return this.memberRepository.save(owner);
  }

  // ============ CONVERSION HELPERS ============

  /**
   * Konvertera PermissionBitMask till readable PermissionFlags-objekt
   */
  maskToFlags(mask: bigint): Record<string, boolean> {
    return {
      ManageMembers: !!(mask & PermissionBitMask.ManageMembers),
      ManageGames: !!(mask & PermissionBitMask.ManageGames),
      ManageSettings: !!(mask & PermissionBitMask.ManageSettings),
      MintNFT: !!(mask & PermissionBitMask.MintNFT),
      MakeTransactions: !!(mask & PermissionBitMask.MakeTransactions),
    };
  }

  /**
   * Konvertera PermissionFlags-objekt till PermissionBitMask
   */
  flagsToMask(flags: Record<string, boolean>): bigint {
    let mask = 0n;
    if (flags.ManageMembers) mask |= PermissionBitMask.ManageMembers;
    if (flags.ManageGames) mask |= PermissionBitMask.ManageGames;
    if (flags.ManageSettings) mask |= PermissionBitMask.ManageSettings;
    if (flags.MintNFT) mask |= PermissionBitMask.MintNFT;
    if (flags.MakeTransactions) mask |= PermissionBitMask.MakeTransactions;
    return mask;
  }

  /**
   * Konvertera PermissionBitMask till string[] för klienten
   */
  maskToPermissionStrings(mask: bigint): string[] {
    const result: string[] = [];
    if (mask & PermissionBitMask.ManageMembers) result.push("ManageMembers");
    if (mask & PermissionBitMask.ManageGames) result.push("ManageGames");
    if (mask & PermissionBitMask.ManageSettings) result.push("ManageSettings");
    if (mask & PermissionBitMask.MintNFT) result.push("MintNFT");
    if (mask & PermissionBitMask.MakeTransactions)
      result.push("MakeTransactions");
    return result;
  }
}
