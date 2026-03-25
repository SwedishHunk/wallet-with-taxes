import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { PlatformService } from "../platform/platform.service";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import {
  PermissionBitMask,
  StudioMember,
  StudioRole,
} from "../platform/entities/studio-member.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { NFTInstance } from "../platform/entities/nft-instance.entity";
import { NFTTemplate } from "../platform/entities/nft-template.entity";
import { StudioMemberService } from "../platform/studio-member.service";
import { User } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcryptjs";
import { ethers } from "ethers";
import { KeyManagementService } from "../shared/key-management.service";
import { JwtService } from "@nestjs/jwt";
import { JwtUser } from "../auth/jwt-user.interface";
import { NFTInventoryService } from "../platform/nft-inventory.service";
import {
  EconomicDirection,
  EconomicScopeType,
} from "../economics/entities/economic-event.entity";
import { EconomicsService } from "../economics/economics.service";

interface DevBootstrapOptions {
  mode?: "player" | "studio" | "admin";
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

interface DevSwitchSessionOptions {
  studioId: string;
  memberId?: string;
}

@Injectable()
export class AdminDevService {
  private readonly seedStudioNames = [
    "North Forge",
    "Silver Arcade",
    "Echo Harbor",
    "Atlas Play",
    "Neon Vale",
    "Iron Pixel",
    "Golden Circuit",
    "Nova Works",
    "Frost Lantern",
    "Rune Harbor",
  ];

  private readonly seedGameNames = [
    "Sky Arena",
    "Dust Raiders",
    "Signal Run",
    "Moon Circuit",
    "Shard Quest",
    "Iron Tides",
    "Night Relay",
    "Echo Drift",
    "Pulse Garden",
    "Star Keep",
  ];

  private readonly seedMemberHandles = [
    "alex.rune",
    "mira.lane",
    "leo.frost",
    "nina.cove",
    "felix.ash",
    "iris.wren",
    "jon.kite",
    "sara.bloom",
    "omar.steel",
    "tova.river",
  ];

  constructor(
    private readonly usersService: UsersService,
    private readonly platformService: PlatformService,
    private readonly studioMemberService: StudioMemberService,
    private readonly nftInventoryService: NFTInventoryService,
    private readonly economicsService: EconomicsService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(NFTTemplate)
    private readonly nftTemplateRepo: Repository<NFTTemplate>,
    @InjectRepository(NFTInstance)
    private readonly nftInstanceRepo: Repository<NFTInstance>,
    @InjectRepository(StudioMember)
    private readonly memberRepo: Repository<StudioMember>,
    private readonly keyManagement: KeyManagementService,
  ) {}

  private verifyJwtToken(token?: string): JwtUser | null {
    if (!token) return null;

    try {
      return this.jwtService.verify<JwtUser>(token);
    } catch {
      return null;
    }
  }

  private resolveAdminActor(
    currentUser?: JwtUser,
    returnToken?: string,
    cookieToken?: string,
  ): JwtUser {
    const candidates = [
      this.verifyJwtToken(returnToken),
      currentUser ?? null,
      this.verifyJwtToken(cookieToken),
    ];

    for (const candidate of candidates) {
      if (candidate?.isAdmin === true) {
        return candidate;
      }
    }

    throw new AppException(
      "Triolith admin session required for session switching",
      403,
    );
  }

  private signSessionToken(user: {
    id: string;
    email?: string;
    walletAddress?: string;
    studioId?: string;
    role?: "owner" | "admin" | "member";
    isAdmin: boolean;
  }) {
    return this.jwtService.sign({
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      studioId: user.studioId,
      role: user.role,
      isAdmin: user.isAdmin,
    });
  }

  private ensureReturnToken(adminUser: JwtUser, returnToken?: string) {
    return returnToken || this.signSessionToken(adminUser);
  }

  private async buildStudioSessionPayload(userId: string, studioId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found for session switch", 404);
    }

    const member = await this.usersService.getMemberSession(userId, studioId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException("User not found for session switch", 404);
    }

    const token = this.signSessionToken({
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      studioId,
      role: member.role,
      isAdmin: user.isAdmin,
    });

    return {
      token,
      studio: {
        studioId: studio.id,
        studioName: studio.name,
        isTriolithAdmin: user.isAdmin === true,
      },
      member: {
        ...member,
        authenticatedAt: new Date().toISOString(),
      },
    };
  }

  private async resolveStudioSessionIdForUser(
    userId: string,
    preferredStudioId?: string | null,
  ) {
    if (preferredStudioId) {
      const preferredMembership = await this.memberRepo.findOne({
        where: {
          user: { id: userId },
          studio: { id: preferredStudioId },
        },
        relations: ["studio"],
      });

      if (preferredMembership?.studio?.id) {
        return preferredMembership.studio.id;
      }
    }

    const fallbackMembership = await this.memberRepo.findOne({
      where: { user: { id: userId } },
      relations: ["studio"],
      order: { createdAt: "ASC" },
    });

    if (!fallbackMembership?.studio?.id) {
      throw new AppException(
        "No valid studio session could be found for this user",
        404,
      );
    }

    return fallbackMembership.studio.id;
  }

  async getSessionTargets(
    currentUser?: JwtUser,
    returnToken?: string,
    cookieToken?: string,
  ) {
    this.assertBootstrapAllowed();

    const adminUser = this.resolveAdminActor(
      currentUser,
      returnToken,
      cookieToken,
    );

    const studios = await this.studioRepo.find({
      relations: ["members", "members.user"],
    });

    return {
      returnToken: this.ensureReturnToken(adminUser, returnToken),
      admin: {
        userId: adminUser.id,
        email: adminUser.email ?? null,
        studioId: adminUser.studioId ?? null,
      },
      studios: studios
        .map((studio) => ({
          id: studio.id,
          name: studio.name,
          status: studio.status,
          members: [...studio.members]
            .sort((left, right) => {
              if (left.isOwner !== right.isOwner) {
                return left.isOwner ? -1 : 1;
              }
              return left.createdAt.getTime() - right.createdAt.getTime();
            })
            .map((member) => ({
              id: member.id,
              userId: member.user.id,
              email: member.user.email,
              isOwner: member.isOwner,
              role: member.role,
              permissions: this.studioMemberService.maskToPermissionStrings(
                member.permissionsMask,
              ),
            })),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  private buildRandomPermissionsMask(): bigint {
    const permissionPool = [
      PermissionBitMask.ManageMembers,
      PermissionBitMask.ManageGames,
      PermissionBitMask.ManageSettings,
      PermissionBitMask.MintNFT,
      PermissionBitMask.MakeTransactions,
    ];

    let mask = 0n;
    for (const permission of permissionPool) {
      if (Math.random() >= 0.5) {
        mask |= permission;
      }
    }

    return mask;
  }

  private pickSeedName(pool: string[], index: number) {
    return pool[index % pool.length];
  }

  private async buildSeedUser(email: string, password: string) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = await this.keyManagement.encrypt(
      wallet.privateKey,
    );

    return this.userRepo.create({
      email,
      passwordHash,
      custodyMode: "custodial",
      encryptedPrivateKey,
      walletAddress: wallet.address,
      kycStatus: "pending",
    });
  }

  private async findBootstrapStudioConflict(email: string, studioName: string) {
    const candidates = await this.studioRepo.find({
      where: [{ name: studioName }, { email }],
      relations: ["members", "members.user"],
    });

    return candidates.find(
      (studio) =>
        studio.members.length === 0 ||
        studio.members.every((member) => member.user?.email !== email),
    );
  }

  private async resolveStudioSession(
    email: string,
    studioName: string,
    password: string,
  ) {
    const loginResult = await this.usersService.login(email, password);
    const baseUser = loginResult.user;

    if (baseUser.studioId) {
      return {
        token: loginResult.token,
        userId: baseUser.id,
        studioId: baseUser.studioId,
        isAdmin: baseUser.isAdmin === true,
      };
    }

    const studioOptions = loginResult.studios ?? [];
    const selectedStudio =
      studioOptions.find((studio) => studio.name === studioName) ??
      (studioOptions.length === 1 ? studioOptions[0] : null);

    if (!selectedStudio) {
      throw new AppException(
        "Dev bootstrap could not resolve a studio session for this user",
        500,
      );
    }

    const studioSession = await this.usersService.selectStudio(
      {
        id: baseUser.id,
        email: baseUser.email,
        walletAddress: baseUser.walletAddress,
        isAdmin: baseUser.isAdmin === true,
      },
      selectedStudio.id,
    );

    return {
      token: studioSession.token,
      userId: baseUser.id,
      studioId: studioSession.studioId,
      isAdmin: studioSession.isTriolithAdmin,
    };
  }

  private assertBootstrapAllowed(providedKey?: string) {
    if (process.env.NODE_ENV === "production") {
      throw new AppException("Dev bootstrap is disabled in production", 403);
    }

    const expectedKey =
      process.env.DEV_BOOTSTRAP_KEY || process.env.ADMIN_API_KEY;
    if (expectedKey && providedKey && providedKey !== expectedKey) {
      throw new AppException("Invalid dev bootstrap key", 401);
    }
  }

  /**
   * Delete all rows that depend on a studio, in FK-safe order, then the
   * studio itself. Used to clean up orphaned dev data before re-bootstrap.
   *
   * Deletion order (deepest FK dependency first):
   *   ledger_entries → game_wallets → nft_instances → game_players
   *   → nft_templates → wallet_deposit_intents → games → studios
   *   (studio_members and StudioUser rows cascade automatically)
   */
  private async purgeStudio(studioId: string): Promise<void> {
    const q = this.dataSource.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(
        `DELETE FROM ledger_entries
         WHERE "walletId" IN (
           SELECT gw.id FROM game_wallets gw
           JOIN game_players gp ON gp.id = gw."gamePlayerId"
           JOIN games g       ON g.id  = gp."gameId"
           WHERE g."studioId" = $1
         )`,
        [studioId],
      );
      await q.query(
        `DELETE FROM nft_instances
         WHERE "ownerId" IN (
           SELECT gp.id FROM game_players gp
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         )`,
        [studioId],
      );
      await q.query(
        `DELETE FROM game_wallets
         WHERE "gamePlayerId" IN (
           SELECT gp.id FROM game_players gp
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         )`,
        [studioId],
      );
      await q.query(
        `DELETE FROM game_players
         WHERE "gameId" IN (SELECT id FROM games WHERE "studioId" = $1)`,
        [studioId],
      );
      await q.query(
        `DELETE FROM nft_templates
         WHERE "gameId" IN (SELECT id FROM games WHERE "studioId" = $1)`,
        [studioId],
      );
      await q.query(
        `DELETE FROM wallet_deposit_intents
         WHERE "gameId" IN (SELECT id FROM games WHERE "studioId" = $1)`,
        [studioId],
      );
      await q.query(`DELETE FROM games WHERE "studioId" = $1`, [studioId]);
      // studio_members and StudioUser rows cascade from the studio FK
      await q.query(`DELETE FROM studios WHERE id = $1`, [studioId]);
      await q.commitTransaction();
    } catch (err) {
      await q.rollbackTransaction();
      throw err;
    } finally {
      await q.release();
    }
  }

  async bootstrap(options: DevBootstrapOptions, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const mode =
      options.mode === "studio"
        ? "studio"
        : options.mode === "admin"
          ? "admin"
          : "player";
    const email =
      options.email?.trim() ||
      (mode === "admin"
        ? "dev-admin@triolith.local"
        : "dev-owner@triolith.local");
    const password = options.password || "DevPass123!";
    const studioName =
      options.studioName?.trim() ||
      (mode === "admin" ? "Triolith Admin Studio" : "Dev Studio");
    const gameName =
      options.gameName?.trim() ||
      (mode === "admin" ? "Admin Demo Game" : "Dev Game");
    const gameSlug =
      options.gameSlug?.trim() ||
      (mode === "admin" ? "admin-demo-game" : "dev-game");

    const existingUser = await this.userRepo.findOne({ where: { email } });

    if (!existingUser) {
      // Clean up any orphaned studio left by a previous failed bootstrap
      // (e.g. on-chain wallet creation reverted after the DB rows committed).
      const orphanedStudio = await this.findBootstrapStudioConflict(
        email,
        studioName,
      );
      if (orphanedStudio) {
        await this.purgeStudio(orphanedStudio.id);
      }
      await this.usersService.signup(email, password, studioName);
    }

    if (mode === "admin") {
      await this.userRepo.update({ email }, { isAdmin: true });
    }

    const session = await this.resolveStudioSession(
      email,
      studioName,
      password,
    );
    const userId = session.userId;
    const studioId = session.studioId;
    if (!studioId) {
      throw new AppException(
        "Studio session was not created during bootstrap login",
        500,
      );
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found after bootstrap login", 404);
    }

    let game =
      (await this.gameRepo.findOne({
        where: { studio: { id: studioId }, slug: gameSlug },
      })) ||
      (await this.gameRepo.findOne({
        where: { studio: { id: studioId }, name: gameName },
      }));

    if (!game) {
      game = await this.platformService.createGameForUser(userId, studioId, {
        name: gameName,
        slug: gameSlug,
      });
    }

    const member = await this.usersService.getMemberSession(userId, studioId);

    return {
      token: session.token,
      credentials: {
        email,
        password,
      },
      studio: {
        studioId: studio.id,
        studioName: studio.name,
        isTriolithAdmin: session.isAdmin === true,
      },
      member,
      game: {
        gameId: game.id,
        name: game.name,
        slug: game.slug,
      },
      routes: {
        dashboard: "/dashboard",
        games: "/games",
        trade: `/player/game/${game.id}/trade`,
        admin: "/triolith-admin",
      },
      recommendedLanding:
        mode === "studio"
          ? "/dashboard"
          : mode === "admin"
            ? "/triolith-admin"
            : `/player/game/${game.id}/trade`,
      mode,
    };
  }

  async switchSession(
    options: DevSwitchSessionOptions,
    currentUser?: JwtUser,
    returnToken?: string,
    cookieToken?: string,
  ) {
    this.assertBootstrapAllowed();

    const adminUser = this.resolveAdminActor(
      currentUser,
      returnToken,
      cookieToken,
    );

    const studioId = options.studioId?.trim();
    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const targetMember = options.memberId?.trim()
      ? await this.memberRepo.findOne({
          where: { id: options.memberId.trim() },
          relations: ["user", "studio"],
        })
      : await this.memberRepo.findOne({
          where: { studio: { id: studioId }, isOwner: true },
          relations: ["user", "studio"],
        });

    if (!targetMember || targetMember.studio.id !== studioId) {
      throw new AppException("Target member was not found in this studio", 404);
    }

    if (targetMember.studio.status === "suspended") {
      throw new AppException(
        "Cannot switch into a suspended studio. Reactivate it from Triolith Admin first.",
        403,
      );
    }

    const payload = await this.buildStudioSessionPayload(
      targetMember.user.id,
      targetMember.studio.id,
    );

    return {
      ...payload,
      returnToken: this.ensureReturnToken(adminUser, returnToken),
      impersonation: {
        active: true,
        targetMemberId: targetMember.id,
        targetUserId: targetMember.user.id,
        targetEmail: targetMember.user.email,
        targetStudioId: targetMember.studio.id,
        targetStudioName: targetMember.studio.name,
        targetRole: targetMember.role,
        isOwner: targetMember.isOwner,
      },
    };
  }

  async restoreSession(
    returnToken?: string,
    currentUser?: JwtUser,
    cookieToken?: string,
  ) {
    this.assertBootstrapAllowed();

    const adminUser = this.resolveAdminActor(
      currentUser,
      returnToken,
      cookieToken,
    );

    const studioId = await this.resolveStudioSessionIdForUser(
      adminUser.id,
      adminUser.studioId,
    );
    const payload = await this.buildStudioSessionPayload(
      adminUser.id,
      studioId,
    );

    return {
      ...payload,
      returnToken: this.ensureReturnToken(adminUser, returnToken),
      impersonation: {
        active: false,
      },
    };
  }

  async seedMembers(
    options: { studioId: string; count?: number },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const requestedCount = options.count ?? 5;
    const count = Math.max(1, Math.min(requestedCount, 50));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found", 404);
    }

    const timestamp = Date.now();
    const created: Array<{
      id: string;
      userId: string;
      email: string;
      role: StudioRole;
      permissions: string[];
    }> = [];

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}-${Math.floor(Math.random() * 10000)}`;
      const handle = this.pickSeedName(this.seedMemberHandles, index).replace(
        /\s+/g,
        "-",
      );
      const email = `${handle}+${suffix}@triolith.local`;
      const password = `SeedPass-${suffix}`;
      const user = await this.userRepo.save(
        await this.buildSeedUser(email, password),
      );

      const permissionsMask = this.buildRandomPermissionsMask();
      const role =
        permissionsMask === 0n ? StudioRole.MEMBER : StudioRole.ADMIN;

      const member = await this.memberRepo.save(
        this.memberRepo.create({
          studio,
          user,
          isOwner: false,
          role,
          permissionsMask,
          gameAccessIds: [],
        }),
      );

      created.push({
        id: member.id,
        userId: user.id,
        email: user.email,
        role,
        permissions:
          this.studioMemberService.maskToPermissionStrings(permissionsMask),
      });
    }

    return {
      studioId: studio.id,
      count: created.length,
      created,
    };
  }

  async clearSeedMembers(options: { studioId: string }, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found", 404);
    }

    const seededMembers = await this.memberRepo
      .createQueryBuilder("member")
      .innerJoinAndSelect("member.user", "user")
      .innerJoinAndSelect("member.studio", "studio")
      .where("studio.id = :studioId", { studioId })
      .andWhere("member.isOwner = false")
      .andWhere("user.email LIKE :seedPattern", {
        seedPattern: "%+%@triolith.local",
      })
      .getMany();

    let removed = 0;
    for (const member of seededMembers) {
      await this.memberRepo.remove(member);
      removed += 1;

      if (member.user?.id) {
        const remainingMemberships = await this.memberRepo
          .createQueryBuilder("member")
          .innerJoin("member.user", "user")
          .where("user.id = :userId", { userId: member.user.id })
          .getCount();
        if (remainingMemberships === 0) {
          await this.userRepo.delete({ id: member.user.id });
        }
      }
    }

    return {
      studioId,
      removed,
    };
  }

  async seedStudios(options: { count?: number }, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const requestedCount = options.count ?? 1;
    const count = Math.max(1, Math.min(requestedCount, 10));
    const timestamp = Date.now();
    const created: Array<{
      studioId: string;
      studioName: string;
      ownerEmail: string;
    }> = [];

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`;
      const baseStudioName = this.pickSeedName(this.seedStudioNames, index);
      const studioName = `${baseStudioName} ${index + 1}`;
      const ownerHandle = this.pickSeedName(
        this.seedMemberHandles,
        index,
      ).replace(/\s+/g, "-");
      const ownerEmail = `${ownerHandle}.owner+${suffix}@triolith.local`;
      const password = `SeedStudioPass-${suffix}!`;

      await this.usersService.signup(ownerEmail, password, studioName);
      const result = await this.resolveStudioSession(
        ownerEmail,
        studioName,
        password,
      );

      created.push({
        studioId: result.studioId,
        studioName,
        ownerEmail,
      });
    }

    return {
      count: created.length,
      created,
    };
  }

  async clearSeedStudios(
    options: { includeAdminBootstrap?: boolean } = {},
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studios = await this.studioRepo.find({
      relations: ["members", "members.user"],
    });

    const targets = studios.filter((studio) => {
      const nameMatch = this.seedStudioNames.some((name) =>
        studio.name.startsWith(name),
      );
      const ownerMatch = studio.members.some((member) =>
        member.user?.email?.includes(".owner+"),
      );
      const adminBootstrapMatch =
        options.includeAdminBootstrap === true &&
        studio.name === "Triolith Admin Studio";

      return nameMatch || ownerMatch || adminBootstrapMatch;
    });

    let removedStudios = 0;
    let removedUsers = 0;

    for (const studio of targets) {
      const userIds = studio.members
        .map((member) => member.user?.id)
        .filter((value): value is string => Boolean(value));

      await this.purgeStudio(studio.id);
      removedStudios += 1;

      for (const userId of userIds) {
        const remainingMemberships = await this.memberRepo
          .createQueryBuilder("member")
          .innerJoin("member.user", "user")
          .where("user.id = :userId", { userId })
          .getCount();

        if (remainingMemberships === 0) {
          await this.userRepo.delete({ id: userId });
          removedUsers += 1;
        }
      }
    }

    return {
      removedStudios,
      removedUsers,
    };
  }

  async seedGames(
    options: { studioId: string; count?: number },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const requestedCount = options.count ?? 5;
    const count = Math.max(1, Math.min(requestedCount, 25));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const studio = await this.studioRepo.findOne({
      where: { id: studioId },
      relations: ["members", "members.user"],
    });
    if (!studio) {
      throw new AppException("Studio not found", 404);
    }

    const actor = studio.members.find(
      (member) => member.isOwner && member.user?.id,
    );
    if (!actor?.user?.id) {
      throw new AppException("Studio owner not found for game seeding", 400);
    }

    const created: Array<{ id: string; name: string; slug: string }> = [];
    const timestamp = Date.now();

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`;
      const baseGameName = this.pickSeedName(this.seedGameNames, index);
      const name = `${baseGameName} ${index + 1}`;
      const slug = `seed-game-${suffix}`;

      const game = await this.platformService.createGameForUser(
        actor.user.id,
        studioId,
        {
          name,
          slug,
        },
      );

      created.push({
        id: game.id,
        name: game.name,
        slug: game.slug,
      });
    }

    return {
      studioId,
      count: created.length,
      created,
    };
  }

  async seedPlayers(
    options: { studioId: string; gameId: string; count?: number },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();
    const requestedCount = options.count ?? 5;
    const count = Math.max(1, Math.min(requestedCount, 25));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
      relations: ["studio"],
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const created: Array<{ playerId: string; userId: string; email: string }> =
      [];
    const timestamp = Date.now();
    const defaultPassword = process.env.DEV_BOOTSTRAP_PASSWORD || "dev123456";

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`;
      const email = `seed-player-${suffix}@triolith.local`;
      const user = await this.userRepo.save(
        await this.buildSeedUser(email, defaultPassword),
      );

      const player = await this.gamePlayerRepo.save(
        this.gamePlayerRepo.create({
          user,
          game,
          level: 1 + (index % 8),
          exp: index * 125,
        }),
      );

      created.push({
        playerId: player.id,
        userId: user.id,
        email: user.email,
      });
    }

    return {
      studioId,
      gameId,
      count: created.length,
      created,
    };
  }

  async clearSeedPlayers(
    options: { studioId: string; gameId: string },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const targets = await this.gamePlayerRepo
      .createQueryBuilder("player")
      .innerJoinAndSelect("player.user", "user")
      .innerJoin("player.game", "game")
      .where("game.id = :gameId", { gameId })
      .andWhere("user.email LIKE :emailPrefix", {
        emailPrefix: "%+%@triolith.local",
      })
      .getMany();
    const playerIds = targets.map((player) => player.id);
    const userIds = targets
      .map((player) => player.user?.id)
      .filter((value): value is string => Boolean(value));
    const walletAddresses = targets
      .map((player) => player.user?.walletAddress)
      .filter((value): value is string => Boolean(value));

    if (playerIds.length === 0) {
      return {
        studioId,
        gameId,
        removedPlayers: 0,
        removedUsers: 0,
      };
    }

    await this.dataSource.query(
      `DELETE FROM marketplace_listings
       WHERE "sellerId" = ANY($1::uuid[]) OR "buyerId" = ANY($1::uuid[])`,
      [playerIds],
    );
    await this.dataSource.query(
      `DELETE FROM ledger_entries
       WHERE "walletId" IN (
         SELECT id FROM game_wallets WHERE "gamePlayerId" = ANY($1::uuid[])
       )`,
      [playerIds],
    );
    await this.dataSource.query(
      `DELETE FROM game_wallets WHERE "gamePlayerId" = ANY($1::uuid[])`,
      [playerIds],
    );
    await this.dataSource.query(
      `DELETE FROM nft_instances WHERE "ownerId" = ANY($1::uuid[])`,
      [playerIds],
    );
    if (walletAddresses.length > 0) {
      await this.dataSource
        .getRepository("economic_events")
        .createQueryBuilder()
        .delete()
        .from("economic_events")
        .where(`metadata ->> 'seeded' = 'true'`)
        .andWhere(`"gameId" = :gameId`, { gameId })
        .andWhere(`"walletAddress" IN (:...walletAddresses)`, {
          walletAddresses,
        })
        .execute();
    }

    const deletedPlayers = await this.gamePlayerRepo
      .createQueryBuilder()
      .delete()
      .from(GamePlayer)
      .where(`id IN (:...playerIds)`, { playerIds })
      .execute();

    let removedUsers = 0;
    for (const userId of userIds) {
      const remainingMemberships = await this.memberRepo.count({
        where: { user: { id: userId } },
      });
      const remainingPlayers = await this.gamePlayerRepo.count({
        where: { user: { id: userId } },
      });

      if (remainingMemberships === 0 && remainingPlayers === 0) {
        await this.userRepo.delete({ id: userId });
        removedUsers += 1;
      }
    }

    return {
      studioId,
      gameId,
      removedPlayers: deletedPlayers.affected ?? 0,
      removedUsers,
    };
  }

  async clearSeedGames(options: { studioId: string }, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const seededGames = await this.gameRepo.find({
      where: {
        studio: { id: studioId },
      },
    });

    const targets = seededGames.filter((game) =>
      game.slug.startsWith("seed-game-"),
    );
    let removed = 0;

    for (const game of targets) {
      await this.purgeGame(game.id);
      removed += 1;
    }

    return {
      studioId,
      removed,
    };
  }

  async seedEconomics(
    options: {
      studioId: string;
      gameId?: string;
      excludeGameId?: string;
      count?: number;
    },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim() || undefined;
    const excludeGameId = options.excludeGameId?.trim() || undefined;
    const requestedCount = options.count ?? 10;
    const count = Math.max(1, Math.min(requestedCount, 50));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found", 404);
    }

    let game: Game | null = null;
    let targetGames: Game[] = [];
    if (gameId) {
      game = await this.gameRepo.findOne({
        where: { id: gameId, studio: { id: studioId } },
      });
      if (!game) {
        throw new AppException("Game not found in studio", 404);
      }
    } else {
      const studioGames = await this.gameRepo.find({
        where: { studio: { id: studioId } },
      });
      targetGames = studioGames.filter(
        (candidate) => candidate.id !== excludeGameId,
      );

      if (targetGames.length === 0) {
        throw new AppException(
          excludeGameId
            ? "Create at least one additional game in this studio before seeding whole-studio events."
            : "At least one game is required before seeding whole-studio events.",
          400,
        );
      }
    }

    const created: string[] = [];
    const eventTypes = [
      "dev_buy",
      "dev_sell",
      "dev_reward",
      "dev_fee",
    ] as const;

    for (let index = 0; index < count; index += 1) {
      const direction =
        index % 4 === 0
          ? EconomicDirection.OUT
          : index % 3 === 0
            ? EconomicDirection.NEUTRAL
            : EconomicDirection.IN;

      const amount = (10 + index * 3).toFixed(2);
      const walletAddress = `0x${(1000 + index).toString(16).padStart(40, "0")}`;
      const eventType = eventTypes[index % eventTypes.length];
      const targetGame = game ?? targetGames[index % targetGames.length];

      const event = await this.economicsService.logEvent({
        source: "devtools",
        eventType,
        scopeType: EconomicScopeType.GAME,
        studioId,
        gameId: targetGame.id,
        walletAddress,
        assetKey: "tri",
        assetSymbol: "TRI",
        amount,
        direction,
        metadata: {
          seeded: true,
          seededMode: game ? "selected-game" : "other-studio-games",
          studioName: studio.name,
          gameName: targetGame.name,
        },
      });

      created.push(event.id);
    }

    return {
      studioId,
      gameId: game?.id ?? null,
      targetGameCount: game ? 1 : targetGames.length,
      count: created.length,
    };
  }

  async clearSeedEconomics(
    options: { studioId: string; gameId?: string; excludeGameId?: string },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim() || undefined;
    const excludeGameId = options.excludeGameId?.trim() || undefined;

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }

    const query = this.dataSource
      .getRepository("economic_events")
      .createQueryBuilder()
      .delete()
      .from("economic_events")
      .where(`metadata ->> 'seeded' = 'true'`)
      .andWhere(`"studioId" = :studioId`, { studioId });

    if (gameId) {
      query.andWhere(`"gameId" = :gameId`, { gameId });
    } else if (excludeGameId) {
      query
        .andWhere(`"gameId" IS NOT NULL`)
        .andWhere(`"gameId" != :excludeGameId`, { excludeGameId });
    }

    const result = await query.execute();

    return {
      studioId,
      gameId: gameId ?? null,
      removed: result.affected ?? 0,
    };
  }

  async seedNftTemplates(
    options: { studioId: string; gameId: string; count?: number },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();
    const requestedCount = options.count ?? 3;
    const count = Math.max(1, Math.min(requestedCount, 12));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
      relations: ["studio"],
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const created: Array<{ id: string; name: string; tier: number }> = [];
    const timestamp = Date.now();
    const tiers = [1, 2, 3, 4] as const;

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}`;
      const tier = tiers[index % tiers.length];
      const template = await this.nftInventoryService.createNFTTemplate(
        gameId,
        studioId,
        {
          name: `Seed Template ${suffix}`,
          tier,
          mintingCost: (10 * tier).toString(),
          upkeepCostPerDay: tier.toString(),
          maxMintCount: 25,
          attributes: {
            seeded: true,
            source: "devtools",
            rarity: tier,
            suffix,
          },
        },
      );

      created.push({
        id: template.id,
        name: template.name,
        tier: template.tier,
      });
    }

    return {
      studioId,
      gameId,
      count: created.length,
      created,
    };
  }

  async clearSeedNftTemplates(
    options: { studioId: string; gameId: string },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const seededTemplates = await this.nftTemplateRepo
      .createQueryBuilder("template")
      .innerJoin("template.game", "game")
      .where("game.id = :gameId", { gameId })
      .andWhere(`template.attributes ->> 'seeded' = 'true'`)
      .getMany();

    const templateIds = seededTemplates.map((template) => template.id);
    if (templateIds.length === 0) {
      return {
        studioId,
        gameId,
        removedTemplates: 0,
        removedInstances: 0,
      };
    }

    const deletedInstances = await this.nftInstanceRepo
      .createQueryBuilder()
      .delete()
      .from(NFTInstance)
      .where(`"templateId" IN (:...templateIds)`, { templateIds })
      .execute();

    const deletedTemplates = await this.nftTemplateRepo
      .createQueryBuilder()
      .delete()
      .from(NFTTemplate)
      .where(`id IN (:...templateIds)`, { templateIds })
      .execute();

    return {
      studioId,
      gameId,
      removedTemplates: deletedTemplates.affected ?? 0,
      removedInstances: deletedInstances.affected ?? 0,
    };
  }

  async seedNftInstances(
    options: { studioId: string; gameId: string; count?: number },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();
    const requestedCount = options.count ?? 4;
    const count = Math.max(1, Math.min(requestedCount, 20));

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const players = await this.gamePlayerRepo.find({
      where: { game: { id: gameId } },
      order: { joinedAt: "ASC" },
    });

    if (players.length === 0) {
      throw new AppException(
        "No game players found. Create or register a player before seeding minted NFTs.",
        400,
      );
    }

    let templates = await this.nftTemplateRepo
      .createQueryBuilder("template")
      .innerJoin("template.game", "game")
      .where("game.id = :gameId", { gameId })
      .andWhere(`template.attributes ->> 'seeded' = 'true'`)
      .orderBy("template.createdAt", "ASC")
      .getMany();

    if (templates.length === 0) {
      await this.seedNftTemplates({
        studioId,
        gameId,
        count: Math.min(3, count),
      });
      templates = await this.nftTemplateRepo
        .createQueryBuilder("template")
        .innerJoin("template.game", "game")
        .where("game.id = :gameId", { gameId })
        .andWhere(`template.attributes ->> 'seeded' = 'true'`)
        .orderBy("template.createdAt", "ASC")
        .getMany();
    }

    const created: Array<{ id: string; templateId: string; ownerId: string }> =
      [];

    for (let index = 0; index < count; index += 1) {
      const template = templates[index % templates.length];
      const player = players[index % players.length];
      const minted = await this.nftInventoryService.mintNFTToPlayer(
        gameId,
        studioId,
        template.id,
        player.id,
      );

      minted.customAttributes = {
        ...(minted.customAttributes ?? {}),
        seeded: true,
        source: "devtools",
      };
      await this.nftInstanceRepo.save(minted);

      created.push({
        id: minted.id,
        templateId: template.id,
        ownerId: player.id,
      });
    }

    return {
      studioId,
      gameId,
      count: created.length,
      created,
      playerCount: players.length,
    };
  }

  async clearSeedNftInstances(
    options: { studioId: string; gameId: string },
    providedKey?: string,
  ) {
    this.assertBootstrapAllowed(providedKey);

    const studioId = options.studioId?.trim();
    const gameId = options.gameId?.trim();

    if (!studioId) {
      throw new AppException("studioId is required", 400);
    }
    if (!gameId) {
      throw new AppException("gameId is required", 400);
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new AppException("Game not found in studio", 404);
    }

    const seededInstances = await this.nftInstanceRepo
      .createQueryBuilder("instance")
      .innerJoin("instance.template", "template")
      .innerJoin("template.game", "game")
      .where("game.id = :gameId", { gameId })
      .andWhere(`instance.customAttributes ->> 'seeded' = 'true'`)
      .getMany();

    const instanceIds = seededInstances.map((instance) => instance.id);
    if (instanceIds.length === 0) {
      return {
        studioId,
        gameId,
        removed: 0,
      };
    }

    const result = await this.nftInstanceRepo
      .createQueryBuilder()
      .delete()
      .from(NFTInstance)
      .where(`id IN (:...instanceIds)`, { instanceIds })
      .execute();

    return {
      studioId,
      gameId,
      removed: result.affected ?? 0,
    };
  }

  async getSystemState(providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const [
      users,
      studios,
      members,
      games,
      sandboxStudios,
      sandboxMembers,
      sandboxGames,
      sandboxEconomicEvents,
      transactionsRaw,
      taxEventsRaw,
      economicEventsRaw,
      listingsRaw,
      nftInstancesRaw,
    ] = await Promise.all([
      this.userRepo.count(),
      this.studioRepo.count(),
      this.memberRepo.count(),
      this.gameRepo.count(),
      this.studioRepo
        .createQueryBuilder("studio")
        .where(
          new Array(this.seedStudioNames.length)
            .fill(0)
            .map((_, index) => `studio.name LIKE :studioName${index}`)
            .join(" OR "),
          Object.fromEntries(
            this.seedStudioNames.map((name, index) => [
              `studioName${index}`,
              `${name}%`,
            ]),
          ),
        )
        .getCount(),
      Promise.resolve().then(async () => {
        const result = await this.userRepo
          .createQueryBuilder("user")
          .where("user.email LIKE :seedPattern", {
            seedPattern: "%+%@triolith.local",
          })
          .getCount();
        return result;
      }),
      this.gameRepo
        .createQueryBuilder("game")
        .where("game.slug LIKE :seedPattern", {
          seedPattern: "seed-game-%",
        })
        .getCount(),
      this.dataSource
        .createQueryBuilder()
        .select("COUNT(*)", "count")
        .from("economic_events", "ev")
        .where(`ev.metadata ->> 'seeded' = 'true'`)
        .getRawOne<{ count: string }>()
        .then((row) => Number(row?.count ?? "0")),
      this.dataSource
        .query(`SELECT COUNT(*)::text AS count FROM shop_events`)
        .then((rows: Array<{ count: string }>) =>
          Number(rows[0]?.count ?? "0"),
        ),
      this.dataSource
        .query(`SELECT COUNT(*)::text AS count FROM "tax_event"`)
        .then((rows: Array<{ count: string }>) => Number(rows[0]?.count ?? "0"))
        .catch(() => 0),
      this.dataSource
        .query(`SELECT COUNT(*)::text AS count FROM economic_events`)
        .then((rows: Array<{ count: string }>) =>
          Number(rows[0]?.count ?? "0"),
        ),
      this.dataSource
        .query(`SELECT COUNT(*)::text AS count FROM marketplace_listings`)
        .then((rows: Array<{ count: string }>) =>
          Number(rows[0]?.count ?? "0"),
        ),
      this.dataSource
        .query(`SELECT COUNT(*)::text AS count FROM nft_instances`)
        .then((rows: Array<{ count: string }>) =>
          Number(rows[0]?.count ?? "0"),
        ),
    ]);

    return {
      mode: "local-dev",
      totals: {
        users,
        studios,
        members,
        games,
        transactions: transactionsRaw,
        taxEvents: taxEventsRaw,
        economicEvents: economicEventsRaw,
        listings: listingsRaw,
        nftInstances: nftInstancesRaw,
      },
      sandbox: {
        studios: sandboxStudios,
        members: sandboxMembers,
        games: sandboxGames,
        economicEvents: sandboxEconomicEvents,
      },
    };
  }

  async clearSandboxData(providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const clearedStudios = await this.clearSeedStudios({}, providedKey);

    const seededGames = await this.gameRepo
      .createQueryBuilder("game")
      .leftJoinAndSelect("game.studio", "studio")
      .where("game.slug LIKE :seedPattern", {
        seedPattern: "seed-game-%",
      })
      .getMany();

    let removedGames = 0;
    for (const game of seededGames) {
      await this.purgeGame(game.id);
      removedGames += 1;
    }

    const seededMembers = await this.memberRepo
      .createQueryBuilder("member")
      .innerJoinAndSelect("member.user", "user")
      .andWhere("member.isOwner = false")
      .andWhere("user.email LIKE :seedPattern", {
        seedPattern: "%+%@triolith.local",
      })
      .getMany();

    let removedMembers = 0;
    let removedUsers = 0;
    for (const member of seededMembers) {
      await this.memberRepo.remove(member);
      removedMembers += 1;

      if (member.user?.id) {
        const remainingMemberships = await this.memberRepo
          .createQueryBuilder("member")
          .innerJoin("member.user", "user")
          .where("user.id = :userId", { userId: member.user.id })
          .getCount();
        if (remainingMemberships === 0) {
          await this.userRepo.delete({ id: member.user.id });
          removedUsers += 1;
        }
      }
    }

    const economicsDeleted = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from("economic_events")
      .where(`metadata ->> 'seeded' = 'true'`)
      .execute();

    return {
      removedStudios: clearedStudios.removedStudios,
      removedGames,
      removedMembers,
      removedUsers: removedUsers + clearedStudios.removedUsers,
      removedEconomicEvents: economicsDeleted.affected ?? 0,
    };
  }

  async fullLocalReset(confirmPhrase?: string, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    if (confirmPhrase !== "RESET LOCAL DEV DATA") {
      throw new AppException(
        'Full reset requires confirmPhrase "RESET LOCAL DEV DATA"',
        400,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`DELETE FROM admin_audit_log`);
      await queryRunner.query(`DELETE FROM marketplace_listings`);
      await queryRunner.query(`DELETE FROM ledger_entries`);
      await queryRunner.query(`DELETE FROM shop_events`);
      await queryRunner.query(`DELETE FROM economic_events`);
      await queryRunner.query(`DELETE FROM "tax_event"`);
      await queryRunner.query(`DELETE FROM "tax_cost_basis"`);
      await queryRunner.query(`DELETE FROM tax_projection_state`);
      await queryRunner.query(`DELETE FROM nft_instances`);
      await queryRunner.query(`DELETE FROM game_wallets`);
      await queryRunner.query(`DELETE FROM wallet_deposit_intents`);
      await queryRunner.query(`DELETE FROM player_nonce`);
      await queryRunner.query(`DELETE FROM game_players`);
      await queryRunner.query(`DELETE FROM player_wallet_identities`);
      await queryRunner.query(`DELETE FROM nft_templates`);
      await queryRunner.query(`DELETE FROM games`);
      await queryRunner.query(`DELETE FROM studio_members`);
      await queryRunner.query(`DELETE FROM studio_user`);
      await queryRunner.query(`DELETE FROM studios`);
      await queryRunner.query(`DELETE FROM "user" WHERE "isAdmin" = false`);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return {
      success: true,
      preserved: ["Triolith admin users", "platform config"],
    };
  }

  private async purgeGame(gameId: string): Promise<void> {
    const q = this.dataSource.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(`DELETE FROM marketplace_listings WHERE "gameId" = $1`, [
        gameId,
      ]);
      await q.query(`DELETE FROM economic_events WHERE "gameId" = $1`, [
        gameId,
      ]);
      await q.query(`DELETE FROM player_nonce WHERE "gameId" = $1`, [gameId]);
      await q.query(
        `DELETE FROM ledger_entries
         WHERE "walletId" IN (
           SELECT gw.id FROM game_wallets gw
           JOIN game_players gp ON gp.id = gw."gamePlayerId"
           WHERE gp."gameId" = $1
         )`,
        [gameId],
      );
      await q.query(
        `DELETE FROM nft_instances
         WHERE "ownerId" IN (
           SELECT gp.id FROM game_players gp WHERE gp."gameId" = $1
         )
         OR "templateId" IN (
           SELECT nt.id FROM nft_templates nt WHERE nt."gameId" = $1
         )`,
        [gameId],
      );
      await q.query(
        `DELETE FROM game_wallets
         WHERE "gamePlayerId" IN (
           SELECT gp.id FROM game_players gp WHERE gp."gameId" = $1
         )`,
        [gameId],
      );
      await q.query(`DELETE FROM wallet_deposit_intents WHERE "gameId" = $1`, [
        gameId,
      ]);
      await q.query(`DELETE FROM nft_templates WHERE "gameId" = $1`, [gameId]);
      await q.query(`DELETE FROM game_players WHERE "gameId" = $1`, [gameId]);
      await q.query(`DELETE FROM games WHERE id = $1`, [gameId]);
      await q.commitTransaction();
    } catch (err) {
      await q.rollbackTransaction();
      throw err;
    } finally {
      await q.release();
    }
  }
}
