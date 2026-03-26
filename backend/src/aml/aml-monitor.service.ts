import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AmlFlag } from "./aml-flag.entity";

export type AmlCheckParams = {
  userAddress: string;
  /** USD-equivalent value of the transaction.  Pass null when no price data is
   *  available — the check will be skipped and a warning logged. */
  amountUsd: number | null;
  txType: "withdrawal" | "purchase" | "transfer";
  /** Optional metadata for investigator review (gameId, nativeAmount, etc.). */
  context?: Record<string, unknown>;
};

/**
 * AmlMonitorService — threshold-based AML transaction monitoring.
 *
 * Any transaction whose USD-equivalent value exceeds USD_THRESHOLD triggers:
 *   1. A persistent `AmlFlag` record (audit trail for MLRO/FI review).
 *   2. A WARN-level log entry.
 *
 * The flagging does NOT block the transaction — blocking is a business/legal
 * decision that requires human review.  Automated blocking without review
 * process is itself a regulatory risk.
 *
 * Regulatory basis: Swedish AML law 2017:630 + AMLD5/6 — obligated entities
 * must monitor for, flag, and (where applicable) report unusual transactions
 * above the €10,000 equivalent threshold to Finanspolisen via STR filings.
 */
@Injectable()
export class AmlMonitorService {
  private readonly logger = new Logger(AmlMonitorService.name);

  /** USD threshold for enhanced due diligence (≈ €10,000 at typical rates). */
  static readonly USD_THRESHOLD = 10_000;

  constructor(
    @InjectRepository(AmlFlag)
    private readonly amlFlagRepo: Repository<AmlFlag>,
  ) {}

  /**
   * Evaluates a transaction against the AML threshold.
   *
   * @returns true if the transaction was flagged; false otherwise.
   */
  async checkAndFlag(params: AmlCheckParams): Promise<boolean> {
    const { userAddress, amountUsd, txType, context } = params;

    if (amountUsd === null) {
      this.logger.warn(
        `[AML] Cannot assess ${txType} for ${userAddress}: no USD price data available. ` +
          "Manual review may be required for large transactions.",
      );
      return false;
    }

    if (amountUsd < AmlMonitorService.USD_THRESHOLD) {
      return false;
    }

    // Threshold exceeded — create persistent flag
    const flag = this.amlFlagRepo.create({
      userAddress: userAddress.toLowerCase(),
      amountUsd,
      txType,
      context: context ?? null,
      reviewed: false,
      reviewNotes: null,
    });
    await this.amlFlagRepo.save(flag);

    this.logger.warn(
      `[AML] Large transaction flagged — user: ${userAddress}, ` +
        `type: ${txType}, amountUSD: ${amountUsd.toFixed(2)}, ` +
        `threshold: ${AmlMonitorService.USD_THRESHOLD}, flagId: ${flag.id}. ` +
        "MLRO review required.",
    );

    return true;
  }

  /** Returns all unreviewed flags, ordered by most recent first. */
  async getUnreviewedFlags(): Promise<AmlFlag[]> {
    return this.amlFlagRepo.find({
      where: { reviewed: false },
      order: { flaggedAt: "DESC" },
    });
  }
}
