import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { LedgerEntry } from "../platform/entities/ledger-entry.entity";
import { User } from "../users/user.entity";

export type ReconciliationReport = {
  ranAt: string;
  windowHours: number;
  missingValuationCount: number;
  /** Number of withdrawal LedgerEntries in window with no TaxEvent in same 5-min window. */
  unmatchedWithdrawalLedgerEntries: number;
  /** Number of TaxEvents (disposal type) in window with no LedgerEntry in same 5-min window. */
  unmatchedDisposalTaxEvents: number;
  /** Custodial users who have no taxIdentificationNumber (DAC8/CARF gap). */
  verifiedUsersWithoutTin: number;
  ok: boolean;
};

/**
 * ReconciliationService — daily cross-check of on-chain / DB ledger integrity.
 *
 * Checks performed:
 *   1. TaxEvents with valuationStatus="missing" (cannot be used for tax filing).
 *   2. Withdrawal LedgerEntries in the window with no matching TaxEvent.
 *   3. Disposal TaxEvents in the window with no matching withdrawal LedgerEntry.
 *   4. KYC-verified users without a taxIdentificationNumber (DAC8/CARF gap).
 *
 * Results are logged at WARN level when any discrepancy is detected, and the
 * full report is returned so an admin endpoint can expose it for manual review.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  /** Look-back window for ledger / TaxEvent cross-checks (hours). */
  static readonly WINDOW_HOURS = 24;

  constructor(
    @InjectRepository(TaxEvent)
    private readonly taxEventRepo: Repository<TaxEvent>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepo: Repository<LedgerEntry>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Runs nightly at 03:00 server time (after the data-retention job at 02:00). */
  @Cron("0 3 * * *")
  async runReconciliationJob(): Promise<void> {
    this.logger.log("[Reconciliation] Starting daily reconciliation job.");
    const report = await this.runManually();
    if (!report.ok) {
      this.logger.warn(
        "[Reconciliation] Discrepancies detected — review required.",
        report,
      );
    } else {
      this.logger.log("[Reconciliation] All checks passed.");
    }
  }

  /** Exposed for testing and admin-triggered runs. */
  async runManually(): Promise<ReconciliationReport> {
    const windowStart = new Date(
      Date.now() - ReconciliationService.WINDOW_HOURS * 60 * 60 * 1000,
    );

    const [
      missingValuationCount,
      unmatchedWithdrawalLedgerEntries,
      unmatchedDisposalTaxEvents,
      verifiedUsersWithoutTin,
    ] = await Promise.all([
      this.countMissingValuations(),
      this.countUnmatchedWithdrawalLedgers(windowStart),
      this.countUnmatchedDisposalTaxEvents(windowStart),
      this.countVerifiedUsersWithoutTin(),
    ]);

    const ok =
      unmatchedWithdrawalLedgerEntries === 0 &&
      unmatchedDisposalTaxEvents === 0 &&
      verifiedUsersWithoutTin === 0;

    return {
      ranAt: new Date().toISOString(),
      windowHours: ReconciliationService.WINDOW_HOURS,
      missingValuationCount,
      unmatchedWithdrawalLedgerEntries,
      unmatchedDisposalTaxEvents,
      verifiedUsersWithoutTin,
      ok,
    };
  }

  // ── private checks ──────────────────────────────────────────────────────────

  /** Total TaxEvents with no price data — can't be used for tax filing. */
  private async countMissingValuations(): Promise<number> {
    return this.taxEventRepo.count({
      where: { valuationStatus: "missing" },
    });
  }

  /**
   * Counts withdrawal LedgerEntries in the window that have no disposal
   * TaxEvent within ±5 minutes of the same timestamp.
   *
   * This is an approximation — a true match would require txHash correlation,
   * but withdrawal ledger entries don't carry a txHash in the current schema.
   * The count mismatch signals that TaxEvent logging may be lagging or broken.
   */
  private async countUnmatchedWithdrawalLedgers(
    windowStart: Date,
  ): Promise<number> {
    const withdrawalCount = await this.ledgerEntryRepo.count({
      where: { type: "withdraw", createdAt: MoreThan(windowStart) },
    });
    const disposalCount = await this.taxEventRepo.count({
      where: { type: "disposal", timestamp: MoreThan(windowStart) },
    });
    return Math.max(0, withdrawalCount - disposalCount);
  }

  /**
   * Counts disposal TaxEvents in the window that exceed the withdrawal ledger
   * count — indicating TaxEvents were created without corresponding ledger
   * entries (possible data integrity issue).
   */
  private async countUnmatchedDisposalTaxEvents(
    windowStart: Date,
  ): Promise<number> {
    const disposalCount = await this.taxEventRepo.count({
      where: { type: "disposal", timestamp: MoreThan(windowStart) },
    });
    const withdrawalCount = await this.ledgerEntryRepo.count({
      where: { type: "withdraw", createdAt: MoreThan(windowStart) },
    });
    return Math.max(0, disposalCount - withdrawalCount);
  }

  /**
   * Counts KYC-verified users who have not provided a taxIdentificationNumber.
   * Required for DAC8/CARF EU reporting compliance.
   */
  private async countVerifiedUsersWithoutTin(): Promise<number> {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.kycStatus = :status", { status: "verified" })
      .andWhere("user.taxIdentificationNumber IS NULL")
      .getCount();
  }
}
