import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Index(["source", "txHash", "logIndex"], { unique: true })
@Entity()
export class TaxEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar" })
  type: "trade" | "mint" | "withdraw" | "reward" | "acquisition" | "disposal";

  @Column()
  userAddress: string;

  @Column()
  assetAddress: string;

  @Column()
  tokenId: number;

  @Column("decimal")
  amount: number;

  @Column("decimal")
  feeUSD: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: "float", nullable: true })
  priceUSD?: number;

  /** SEK price at the time of the event — required for Swedish tax filings. */
  @Column({ type: "float", nullable: true })
  priceSEK?: number | null;

  /** SEK/USD exchange rate at event timestamp (e.g. 10.45 means 1 USD = 10.45 SEK). */
  @Column({ type: "float", nullable: true })
  exchangeRateSEKUSD?: number | null;

  /** Source of the SEK exchange rate (e.g. "riksbanken", "ecb", "coinbase"). */
  @Column({ type: "varchar", length: 60, nullable: true })
  exchangeRateSource?: string | null;

  /**
   * Swedish tax treatment classification.
   * - capital_gain: 30% tax, 70% loss deductibility (48 kap IL)
   * - income: marginal tax rate (may apply to rewards/earned TRI)
   * - unknown: requires manual review before filing
   */
  @Column({ type: "varchar", length: 20, default: "unknown" })
  taxTreatment: "capital_gain" | "income" | "unknown";

  @Column({ type: "varchar", length: 24, default: "missing" })
  valuationStatus: "authoritative" | "estimated" | "missing";

  @Column({ type: "varchar", length: 120, nullable: true })
  valuationSource?: string | null;

  @Column({ type: "varchar", nullable: true })
  source?: string | null;

  @Column({ type: "varchar", nullable: true })
  txHash?: string | null;

  @Column({ type: "int", nullable: true })
  logIndex?: number | null;
}
