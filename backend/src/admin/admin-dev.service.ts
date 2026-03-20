import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { PlatformService } from "../platform/platform.service";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import { User } from "../users/user.entity";
import { UsersService } from "../users/users.service";

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
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) {}

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
}
