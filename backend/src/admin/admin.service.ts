import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { User } from "../users/user.entity";
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
}
