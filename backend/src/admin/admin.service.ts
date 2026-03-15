import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { User } from "../users/user.entity";
import { Studio } from "../platform/entities/studio.entity";
import { EconomicEvent } from "../economics/entities/economic-event.entity";
import { PlatformConfig } from "./platform-config.entity";
import { Repository } from "typeorm";

interface FeeStatsRaw {
  totalFeesUSD: string;
  totalTrades: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(TaxEvent)
    private readonly taxRepo: Repository<TaxEvent>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,

    @InjectRepository(EconomicEvent)
    private readonly economicEventRepo: Repository<EconomicEvent>,

    @InjectRepository(PlatformConfig)
    private readonly platformConfigRepo: Repository<PlatformConfig>,
  ) {}

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
    const devShare = totalFees * 0.6;
    const triolithGross = totalFees * 0.3;
    const safuCut = triolithGross * 0.05;
    const triolithNet = triolithGross - safuCut;
    const stakerShare = totalFees * 0.1;

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
        "createdAt",
      ],
      order: { createdAt: "DESC" },
    });

    return users;
  }

  async getAllStudios() {
    const studios = await this.studioRepo.find({
      relations: ["members"],
      order: { createdAt: "DESC" },
    });

    return studios.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      status: s.status,
      memberCount: s.members?.length ?? 0,
      createdAt: s.createdAt,
    }));
  }

  async getAllTransactions(limit = 50, offset = 0) {
    const [events, total] = await this.economicEventRepo.findAndCount({
      order: { timestamp: "DESC" },
      take: limit,
      skip: offset,
    });

    return { events, total, limit, offset };
  }

  async setStudioStatus(id: string, status: "active" | "suspended") {
    const studio = await this.studioRepo.findOne({ where: { id } });
    if (!studio) throw new NotFoundException(`Studio ${id} not found`);
    await this.studioRepo.update(id, { status });
    return { id, status };
  }

  async setUserAdmin(id: string, isAdmin: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.update(id, { isAdmin });
    return { id, isAdmin };
  }

  async setUserSuspended(id: string, isSuspended: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.update(id, { isSuspended });
    return { id, isSuspended };
  }

  async getPlatformFee() {
    const config = await this.platformConfigRepo.findOne({
      where: { key: "platform_fee_percent" },
    });
    return { feePercent: Number(config?.value ?? 2.5) };
  }

  async setPlatformFee(feePercent: number) {
    await this.platformConfigRepo.save({
      key: "platform_fee_percent",
      value: feePercent,
    });
    return { feePercent };
  }
}
