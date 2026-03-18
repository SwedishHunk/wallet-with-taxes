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

    const email = options.email?.trim() || "dev-owner@triolith.local";
    const password = options.password || "DevPass123!";
    const studioName = options.studioName?.trim() || "Dev Studio";
    const gameName = options.gameName?.trim() || "Dev Game";
    const gameSlug = options.gameSlug?.trim() || "dev-game";

    const existingUser = await this.userRepo.findOne({ where: { email } });

    if (!existingUser) {
      // Clean up any orphaned studio left by a previous failed bootstrap
      // (e.g. on-chain wallet creation reverted after the DB rows committed).
      const orphanedStudio = await this.studioRepo.findOne({
        where: { name: studioName },
      });
      if (orphanedStudio) {
        await this.purgeStudio(orphanedStudio.id);
      }
      await this.usersService.signup(email, password, studioName);
    }

    const loginResult = await this.usersService.login(email, password);
    const userId = loginResult.user.id;
    const studioId = loginResult.user.studioId;

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
      token: loginResult.token,
      credentials: {
        email,
        password,
      },
      studio: {
        studioId: studio.id,
        studioName: studio.name,
        isTriolithAdmin: loginResult.user.isAdmin === true,
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
      },
    };
  }
}
