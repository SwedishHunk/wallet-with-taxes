import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { ShopEvent } from "../tokenshop/entities/shop-event.entity";
import { User } from "../users/user.entity";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { EconomicEvent } from "../economics/entities/economic-event.entity";
import { PlatformConfig } from "./platform-config.entity";
import { AdminAuditLog } from "./admin-audit-log.entity";
import { ethers } from "ethers";
import { DataSource, Repository } from "typeorm";
import {
  REVENUE_SPLIT_DEV,
  REVENUE_SPLIT_TRIOLITH,
  REVENUE_SPLIT_STAKERS,
  SAFU_CUT_FROM_TRIOLITH,
  DEFAULT_PLATFORM_FEE_PERCENT,
} from "../shared/constants/business.constants";

interface FeeStatsRaw {
  totalFeesUSD: string;
  totalTrades: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(TaxEvent)
    private readonly taxRepo: Repository<TaxEvent>,

    @InjectRepository(ShopEvent)
    private readonly shopEventRepo: Repository<ShopEvent>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,

    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,

    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,

    @InjectRepository(EconomicEvent)
    private readonly economicEventRepo: Repository<EconomicEvent>,

    @InjectRepository(PlatformConfig)
    private readonly platformConfigRepo: Repository<PlatformConfig>,

    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepo: Repository<AdminAuditLog>,

    private readonly dataSource: DataSource,
  ) {}

  private async writeAudit(
    adminId: string,
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string | null,
    details?: Record<string, unknown>,
  ) {
    try {
      const entry = this.auditLogRepo.create({
        adminId,
        adminEmail,
        action,
        targetType,
        targetId: targetId ?? undefined,
        details,
      });
      await this.auditLogRepo.save(entry);
    } catch (err) {
      // Audit log failure must never block the actual admin action
      console.warn("[AdminAuditLog] Failed to write audit entry:", err);
    }
  }

  async getFeeStats(from?: string, to?: string) {
    const query = this.taxRepo
      .createQueryBuilder("tax")
      .where("tax.feeUSD IS NOT NULL");

    if (from) {
      query.andWhere("tax.timestamp >= :from", { from });
    }

    if (to) {
      query.andWhere("tax.timestamp <= :to", { to });
    }

    const raw = await query
      .select([
        'COALESCE(SUM(tax.feeUSD), 0)::text AS "totalFeesUSD"',
        'COUNT(*)::text AS "totalTrades"',
      ])
      .getRawOne<FeeStatsRaw>();

    const safeRaw: FeeStatsRaw = raw ?? {
      totalFeesUSD: "0",
      totalTrades: "0",
    };

    return {
      totalFeesUSD: Number(safeRaw.totalFeesUSD),
      totalTrades: Number(safeRaw.totalTrades),
      from,
      to,
    };
  }

  async getRevenueSplit(from?: string, to?: string) {
    const query = this.taxRepo
      .createQueryBuilder("tax")
      .where("tax.feeUSD IS NOT NULL");

    if (from) query.andWhere("tax.timestamp >= :from", { from });
    if (to) query.andWhere("tax.timestamp <= :to", { to });

    const raw = await query
      .select(['COALESCE(SUM(tax.feeUSD), 0)::text AS "totalFeesUSD"'])
      .getRawOne<{ totalFeesUSD: string }>();

    const totalFees = Number(raw?.totalFeesUSD ?? "0");
    const devShare = totalFees * REVENUE_SPLIT_DEV;
    const triolithGross = totalFees * REVENUE_SPLIT_TRIOLITH;
    const safuCut = triolithGross * SAFU_CUT_FROM_TRIOLITH;
    const triolithNet = triolithGross - safuCut;
    const stakerShare = totalFees * REVENUE_SPLIT_STAKERS;

    return {
      totalFeesUSD: totalFees,
      devShareUSD: devShare,
      triolithNetUSD: triolithNet,
      safuShareUSD: safuCut,
      stakerShareUSD: stakerShare,
      from,
      to,
    };
  }

  async getUserList() {
    const users = await this.userRepo.find({
      select: [
        "id",
        "email",
        "walletAddress",
        "custodyMode",
        "kycStatus",
        "isAdmin",
        "isSuspended",
        "createdAt",
      ],
      order: { createdAt: "DESC" },
    });

    return users;
  }

  async getAllStudios() {
    // Single query: COUNT members per studio via LEFT JOIN instead of
    // loading all StudioMember rows into memory with relations: ["members"]
    const rows = await this.studioRepo
      .createQueryBuilder("s")
      .leftJoin("s.members", "m")
      .select([
        "s.id           AS id",
        "s.name         AS name",
        "s.email        AS email",
        "s.status       AS status",
        's.createdAt    AS "createdAt"',
        'COUNT(m.id)::int AS "memberCount"',
      ])
      .groupBy("s.id")
      .orderBy("s.createdAt", "DESC")
      .getRawMany<{
        id: string;
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        memberCount: number;
      }>();

    return rows;
  }

  async getAllTransactions(limit = 50, offset = 0) {
    const [events, total] = await this.shopEventRepo.findAndCount({
      order: { blockNumber: "DESC", logIndex: "DESC" },
      take: limit,
      skip: offset,
    });

    const fmt18 = (raw: string) => {
      try {
        return ethers.formatUnits(BigInt(raw), 18);
      } catch {
        return raw;
      }
    };

    const mapped = events.map((e) => ({
      id: e.id,
      type: e.type,
      userAddress: e.user,
      assetAddress: e.asset,
      assetSymbol: e.assetSymbol,
      amountIn: fmt18(e.amountIn),
      amountOut: fmt18(e.amountOut),
      blockNumber: e.blockNumber,
      txHash: e.txHash,
      timestamp: e.createdAt,
    }));

    return { events: mapped, total, limit, offset };
  }

  async setStudioStatus(
    id: string,
    status: "active" | "suspended",
    adminId: string,
    adminEmail: string,
  ) {
    const studio = await this.studioRepo.findOne({ where: { id } });
    if (!studio) throw new NotFoundException(`Studio ${id} not found`);
    await this.studioRepo.update(id, { status });
    await this.writeAudit(
      adminId,
      adminEmail,
      "setStudioStatus",
      "studio",
      id,
      { status },
    );
    return { id, status };
  }

  async setUserAdmin(
    id: string,
    isAdmin: boolean,
    adminId: string,
    adminEmail: string,
  ) {
    // Prevent an admin from revoking their own admin rights
    if (id === adminId && isAdmin === false) {
      throw new BadRequestException("Cannot revoke your own admin privileges");
    }

    // Prevent removing the last admin — always keep at least one
    if (isAdmin === false) {
      const adminCount = await this.userRepo.count({
        where: { isAdmin: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException("Cannot remove the last platform admin");
      }
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.update(id, { isAdmin });
    await this.writeAudit(adminId, adminEmail, "setUserAdmin", "user", id, {
      isAdmin,
    });
    return { id, isAdmin };
  }

  async setUserSuspended(
    id: string,
    isSuspended: boolean,
    adminId: string,
    adminEmail: string,
  ) {
    if (id === adminId && isSuspended === true) {
      throw new BadRequestException("Cannot suspend your own admin account");
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.update(id, { isSuspended });
    await this.writeAudit(adminId, adminEmail, "setUserSuspended", "user", id, {
      isSuspended,
    });
    return { id, isSuspended };
  }

  async getPlatformFee() {
    const config = await this.platformConfigRepo.findOne({
      where: { key: "platform_fee_percent" },
    });
    return {
      feePercent: Number(config?.value ?? DEFAULT_PLATFORM_FEE_PERCENT),
    };
  }

  async setPlatformFee(
    feePercent: number,
    adminId: string,
    adminEmail: string,
  ) {
    await this.platformConfigRepo.save({
      key: "platform_fee_percent",
      value: feePercent,
    });
    await this.writeAudit(
      adminId,
      adminEmail,
      "setPlatformFee",
      "platform",
      null,
      { feePercent },
    );
    return { feePercent };
  }

  async deleteUser(id: string, adminId: string, adminEmail: string) {
    if (id === adminId) {
      throw new BadRequestException("Cannot delete your own admin account");
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.delete(id);
    await this.writeAudit(adminId, adminEmail, "deleteUser", "user", id);
    return { id, deleted: true };
  }

  async deleteStudio(id: string, adminId: string, adminEmail: string) {
    const studio = await this.studioRepo.findOne({ where: { id } });
    if (!studio) throw new NotFoundException(`Studio ${id} not found`);
    await this.purgeStudio(id);
    await this.writeAudit(adminId, adminEmail, "deleteStudio", "studio", id);
    return { id, deleted: true };
  }

  async deleteGame(id: string, adminId: string, adminEmail: string) {
    const game = await this.gameRepo.findOne({ where: { id } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);
    await this.purgeGame(id);
    await this.writeAudit(adminId, adminEmail, "deleteGame", "game", id);
    return { id, deleted: true };
  }

  async getAuditLog(limit = 50, offset = 0) {
    try {
      const [entries, total] = await this.auditLogRepo.findAndCount({
        order: { createdAt: "DESC" },
        take: limit,
        skip: offset,
      });
      return { entries, total, limit, offset };
    } catch {
      // Table may not exist yet if migration hasn't run
      return { entries: [], total: 0, limit, offset };
    }
  }

  async getStudioGames(studioId: string) {
    const games = await this.gameRepo.find({
      where: { studio: { id: studioId } },
      order: { createdAt: "DESC" },
    });
    return games;
  }

  async getStudioMembers(studioId: string) {
    const studio = await this.studioRepo.findOne({
      where: { id: studioId },
      relations: ["members", "members.user"],
    });
    if (!studio) {
      throw new NotFoundException(`Studio ${studioId} not found`);
    }

    return [...studio.members]
      .sort((left, right) => {
        if (left.isOwner !== right.isOwner) {
          return left.isOwner ? -1 : 1;
        }
        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .map((member) => ({
        id: member.id,
        userId: member.user.id,
        email: member.user.email,
        isOwner: member.isOwner,
        role: member.role,
        permissions: member.permissionsMask.toString(),
        createdAt: member.createdAt,
      }));
  }

  async getStudioPlayers(studioId: string) {
    const players = await this.gamePlayerRepo.find({
      where: { game: { studio: { id: studioId } } },
      relations: ["game", "user", "walletIdentity"],
      order: { joinedAt: "DESC" },
    });

    return players.map((player) => ({
      id: player.id,
      gameId: player.game?.id ?? null,
      gameName: player.game?.name ?? null,
      userId: player.user?.id ?? null,
      email: player.user?.email ?? null,
      walletAddress:
        player.user?.walletAddress ?? player.walletIdentity?.walletAddress ?? null,
      joinedAt: player.joinedAt,
      level: player.level,
      exp: player.exp,
      source: player.user ? "user" : player.walletIdentity ? "wallet" : "unknown",
    }));
  }

  async getStudioTransactions(studioId: string, limit = 25) {
    const events = await this.economicEventRepo.find({
      where: { studioId },
      order: { timestamp: "DESC", createdAt: "DESC" },
      take: Math.min(limit, 100),
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      direction: event.direction,
      amount: event.amount,
      assetKey: event.assetKey,
      walletAddress: event.walletAddress,
      gameId: event.gameId,
      timestamp: event.timestamp,
      metadata: event.metadata ?? null,
    }));
  }

  async getGamePlayers(gameId: string) {
    const players = await this.gamePlayerRepo.find({
      where: { game: { id: gameId } },
      relations: ["game", "user", "walletIdentity"],
      order: { joinedAt: "DESC" },
    });

    return players.map((player) => ({
      id: player.id,
      gameId: player.game?.id ?? null,
      gameName: player.game?.name ?? null,
      userId: player.user?.id ?? null,
      email: player.user?.email ?? null,
      walletAddress:
        player.user?.walletAddress ?? player.walletIdentity?.walletAddress ?? null,
      joinedAt: player.joinedAt,
      level: player.level,
      exp: player.exp,
      source: player.user ? "user" : player.walletIdentity ? "wallet" : "unknown",
    }));
  }

  async getGameTransactions(gameId: string, limit = 25) {
    const events = await this.economicEventRepo.find({
      where: { gameId },
      order: { timestamp: "DESC", createdAt: "DESC" },
      take: Math.min(limit, 100),
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      direction: event.direction,
      amount: event.amount,
      assetKey: event.assetKey,
      walletAddress: event.walletAddress,
      gameId: event.gameId,
      timestamp: event.timestamp,
      metadata: event.metadata ?? null,
    }));
  }

  async getAllGames() {
    const games = await this.gameRepo.find({
      relations: ["studio"],
      order: { createdAt: "DESC" },
    });
    return games.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      status: g.status,
      studioId: g.studio?.id ?? null,
      studioName: g.studio?.name ?? null,
      createdAt: g.createdAt,
    }));
  }

  async setGameStatus(
    id: string,
    status: "active" | "inactive",
    adminId: string,
    adminEmail: string,
  ) {
    const game = await this.gameRepo.findOne({ where: { id } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);
    await this.gameRepo.update(id, { status });
    await this.writeAudit(adminId, adminEmail, "setGameStatus", "game", id, {
      status,
    });
    return { id, status };
  }

  async getEconomicsSummaryPerStudio() {
    const rows = await this.economicEventRepo
      .createQueryBuilder("ev")
      .where("ev.studioId IS NOT NULL")
      .select([
        'ev.studioId AS "studioId"',
        'COUNT(*) AS "eventCount"',
        `SUM(CASE WHEN ev.direction = 'in' THEN CAST(ev.amount AS numeric) ELSE 0 END) AS "totalIn"`,
        `SUM(CASE WHEN ev.direction = 'out' THEN CAST(ev.amount AS numeric) ELSE 0 END) AS "totalOut"`,
        'MAX(ev.timestamp) AS "lastSeen"',
      ])
      .groupBy("ev.studioId")
      .getRawMany<{
        studioId: string;
        eventCount: string;
        totalIn: string | null;
        totalOut: string | null;
        lastSeen: string | null;
      }>();

    return rows.map((r) => ({
      studioId: r.studioId,
      eventCount: Number(r.eventCount),
      totalIn: parseFloat(r.totalIn ?? "0"),
      totalOut: parseFloat(r.totalOut ?? "0"),
      lastSeen: r.lastSeen,
      }));
  }

  private async purgeStudio(studioId: string): Promise<void> {
    const q = this.dataSource.createQueryRunner();
    await q.connect();
    await q.startTransaction();
    try {
      await q.query(
        `DELETE FROM marketplace_listings
         WHERE "sellerId" IN (
           SELECT gp.id FROM game_players gp
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         ) OR "buyerId" IN (
           SELECT gp.id FROM game_players gp
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         )`,
        [studioId],
      );
      await q.query(
        `DELETE FROM ledger_entries
         WHERE "walletId" IN (
           SELECT gw.id FROM game_wallets gw
           JOIN game_players gp ON gp.id = gw."gamePlayerId"
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         )`,
        [studioId],
      );
      await q.query(`DELETE FROM economic_events WHERE "studioId" = $1`, [studioId]);
      await q.query(`DELETE FROM "tax_event" WHERE "studioId" = $1`, [studioId]);
      await q.query(
        `DELETE FROM player_nonce
         WHERE "gameId" IN (SELECT id FROM games WHERE "studioId" = $1)`,
        [studioId],
      );
      await q.query(
        `DELETE FROM nft_instances
         WHERE "ownerId" IN (
           SELECT gp.id FROM game_players gp
           JOIN games g ON g.id = gp."gameId"
           WHERE g."studioId" = $1
         )
         OR "templateId" IN (
           SELECT nt.id FROM nft_templates nt
           JOIN games g ON g.id = nt."gameId"
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
        `DELETE FROM wallet_deposit_intents
         WHERE "gameId" IN (SELECT id FROM games WHERE "studioId" = $1)`,
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
      await q.query(`DELETE FROM studio_members WHERE "studioId" = $1`, [studioId]);
      await q.query(`DELETE FROM "studio_user" WHERE "studioId" = $1`, [studioId]);
      await q.query(`DELETE FROM games WHERE "studioId" = $1`, [studioId]);
      await q.query(`DELETE FROM studios WHERE id = $1`, [studioId]);
      await q.commitTransaction();
    } catch (err) {
      await q.rollbackTransaction();
      throw err;
    } finally {
      await q.release();
    }
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
