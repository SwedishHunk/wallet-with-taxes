import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  UpdateDateColumn,
} from "typeorm";

/**
 * Running cost-basis snapshot per user + asset.
 *
 * WHY THIS EXISTS:
 * Previously, getSummary() loaded EVERY tax event for a user into memory
 * and recalculated from scratch. With 10 trades that's fine, but with
 * 10,000 trades it becomes slow and wastes memory.
 *
 * This table maintains a running tally of:
 *   - quantity: how many units the user currently holds
 *   - totalCost: total acquisition cost in USD
 *   - realizedGains / realizedLosses: cumulative gains/losses from disposals
 *
 * Each new acquisition or disposal updates these counters incrementally
 * instead of reprocessing the entire history.
 */
@Entity()
@Unique(["userAddress", "assetKey"])
export class TaxCostBasis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userAddress: string;

  /** Format: "assetAddress:tokenId" (matches the tax event key) */
  @Column()
  assetKey: string;

  /** Current quantity held (increases on acquisition, decreases on disposal) */
  @Column("decimal", { default: 0 })
  quantity: number;

  /** Total cost of current holdings in USD */
  @Column("decimal", { default: 0 })
  totalCost: number;

  /** Cumulative realized gains in USD (positive) */
  @Column("decimal", { default: 0 })
  realizedGains: number;

  /** Cumulative realized losses in USD (negative) */
  @Column("decimal", { default: 0 })
  realizedLosses: number;

  /** Last tax event ID that was processed (for idempotency) */
  @Column({ default: 0 })
  lastProcessedEventId: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
