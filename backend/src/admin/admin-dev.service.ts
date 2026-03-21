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
import { StudioMemberService } from "../platform/studio-member.service";
import { User } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcryptjs";
import { ethers } from "ethers";
import { encryptPrivateKey } from "../shared/crypto.util";

interface DevBootstrapOptions {
  mode?: "player" | "studio" | "admin";
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

@Injectable()
export class AdminDevService {
  constructor(
    private readonly usersService: UsersService,
    private readonly platformService: PlatformService,
    private readonly studioMemberService: StudioMemberService,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(StudioMember)
    private readonly memberRepo: Repository<StudioMember>,
  ) {}

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

  private async buildSeedUser(email: string, password: string) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const wallet = ethers.Wallet.createRandom();

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new AppException("ENCRYPTION_KEY env var is missing", 500);
    }

    return this.userRepo.create({
      email,
      passwordHash,
      custodyMode: "custodial",
      encryptedPrivateKey: encryptPrivateKey(wallet.privateKey, encryptionKey),
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
      const email = `seed-member-${suffix}@triolith.local`;
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
        permissions: this.studioMemberService.maskToPermissionStrings(
          permissionsMask,
        ),
      });
    }

    return {
      studioId: studio.id,
      count: created.length,
      created,
    };
  }

  async clearSeedMembers(
    options: { studioId: string },
    providedKey?: string,
  ) {
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
        seedPattern: "seed-member-%@triolith.local",
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

    const actor = studio.members.find((member) => member.isOwner && member.user?.id);
    if (!actor?.user?.id) {
      throw new AppException("Studio owner not found for game seeding", 400);
    }

    const created: Array<{ id: string; name: string; slug: string }> = [];
    const timestamp = Date.now();

    for (let index = 0; index < count; index += 1) {
      const suffix = `${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`;
      const name = `Seed Game ${suffix}`;
      const slug = `seed-game-${suffix}`;

      const game = await this.platformService.createGameForUser(actor.user.id, studioId, {
        name,
        slug,
      });

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

  async clearSeedGames(
    options: { studioId: string },
    providedKey?: string,
  ) {
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

    const targets = seededGames.filter((game) => game.slug.startsWith("seed-game-"));
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

  private async purgeGame(gameId: string): Promise<void> {
    const q = this.dataSource.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(`DELETE FROM marketplace_listings WHERE "gameId" = $1`, [gameId]);
      await q.query(`DELETE FROM economic_events WHERE "gameId" = $1`, [gameId]);
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
      await q.query(`DELETE FROM wallet_deposit_intents WHERE "gameId" = $1`, [gameId]);
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
