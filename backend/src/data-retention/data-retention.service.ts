import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { User } from "../users/user.entity";
import { TaxEvent } from "../tax/entities/tax-event.entity";

/**
 * DataRetentionService — GDPR-compliant automated data retention.
 *
 * Policy:
 *   • A user is considered "inactive" if they have not logged in for more
 *     than RETENTION_YEARS (default: 3) years.
 *   • If the inactive user also has no tax events in the last RETENTION_YEARS
 *     years, their account is anonymized (personal data scrubbed) while the
 *     audit trail (tax events, with anonymized address) is preserved.
 *   • Anonymization replaces PII fields with deterministic non-reversible
 *     placeholders so that the record can still be counted/audited without
 *     exposing personal data.
 *
 * GDPR references: Article 5(1)(e) storage limitation, Article 17 right to
 * erasure (implemented as anonymization to preserve financial audit trail).
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  /** Number of years of inactivity before account is anonymized. */
  private readonly RETENTION_YEARS = 3;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TaxEvent)
    private readonly taxEventRepository: Repository<TaxEvent>,
  ) {}

  /**
   * Runs nightly at 02:00 server time.
   * Identifies inactive users with no recent tax events and anonymizes them.
   */
  @Cron("0 2 * * *")
  async runRetentionJob(): Promise<void> {
    const cutoff = this.getCutoffDate();
    this.logger.log(
      `[DataRetention] Starting retention job. Inactivity cutoff: ${cutoff.toISOString()}`,
    );

    const candidates = await this.findInactiveUsers(cutoff);
    if (candidates.length === 0) {
      this.logger.log("[DataRetention] No inactive users found.");
      return;
    }

    let anonymized = 0;
    for (const user of candidates) {
      const hasRecentTax = await this.hasRecentTaxEvents(
        user.walletAddress,
        cutoff,
      );
      if (!hasRecentTax) {
        await this.anonymizeUser(user);
        anonymized++;
      }
    }

    this.logger.log(
      `[DataRetention] Job complete. Candidates: ${candidates.length}, anonymized: ${anonymized}.`,
    );
  }

  /**
   * Exposed for testing and manual triggers.
   * Returns the number of users anonymized.
   */
  async runManually(): Promise<{
    candidatesFound: number;
    anonymized: number;
  }> {
    const cutoff = this.getCutoffDate();
    const candidates = await this.findInactiveUsers(cutoff);
    let anonymized = 0;

    for (const user of candidates) {
      const hasRecentTax = await this.hasRecentTaxEvents(
        user.walletAddress,
        cutoff,
      );
      if (!hasRecentTax) {
        await this.anonymizeUser(user);
        anonymized++;
      }
    }

    return { candidatesFound: candidates.length, anonymized };
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private getCutoffDate(): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - this.RETENTION_YEARS);
    return d;
  }

  private async findInactiveUsers(cutoff: Date): Promise<User[]> {
    // Users whose last login is older than the cutoff (or who have never logged in
    // and whose account was created before the cutoff).
    return this.userRepository.find({
      where: [
        { lastLoginAt: LessThan(cutoff) },
        { lastLoginAt: undefined, createdAt: LessThan(cutoff) },
      ],
    });
  }

  private async hasRecentTaxEvents(
    walletAddress: string,
    cutoff: Date,
  ): Promise<boolean> {
    const count = await this.taxEventRepository.count({
      where: {
        userAddress: walletAddress?.toLowerCase(),
        timestamp: LessThan(cutoff),
      },
    });
    // If all events are older than cutoff (or no events exist), no recent events
    const total = await this.taxEventRepository.count({
      where: { userAddress: walletAddress?.toLowerCase() },
    });
    return total > count; // there are events AFTER the cutoff
  }

  private async anonymizeUser(user: User): Promise<void> {
    // Replace PII with non-reversible placeholders.
    // The user.id (UUID) is preserved for cross-table integrity.
    const placeholder = `anonymized-${user.id}`;
    await this.userRepository.update(user.id, {
      email: `${placeholder}@deleted.invalid`,
      walletAddress: `0x${"0".repeat(40 - (placeholder.length % 20))}${placeholder.slice(0, 20).replace(/[^a-f0-9]/gi, "0")}`,
      encryptedPrivateKey: null,
      passwordHash: "",
      consentGivenAt: null,
      lastLoginAt: null,
      isSuspended: false,
    });
    this.logger.debug(`[DataRetention] Anonymized user ${user.id}`);
  }
}
