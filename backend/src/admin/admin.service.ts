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
import { EconomicEvent } from "../economics/entities/economic-event.entity";
import { PlatformConfig } from "./platform-config.entity";
import { AdminAuditLog } from "./admin-audit-log.entity";
import { Repository } from "typeorm";
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

    @InjectRepository(EconomicEvent)
    private readonly economicEventRepo: Repository<EconomicEvent>,

    @InjectRepository(PlatformConfig)
    private readonly platformConfigRepo: Repository<PlatformConfig>,

    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepo: Repository<AdminAuditLog>,
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

    const mapped = events.map((e) => ({
      id: e.id,
      type: e.type,
      userAddress: e.user,
      assetAddress: e.asset,
      assetSymbol: e.assetSymbol,
      amountIn: e.amountIn,
      amountOut: e.amountOut,
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
    await this.studioRepo.delete(id);
    await this.writeAudit(adminId, adminEmail, "deleteStudio", "studio", id);
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
}
