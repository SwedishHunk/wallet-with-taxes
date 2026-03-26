import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

/**
 * AmlFlag — persisted record of a transaction that triggered an AML alert.
 *
 * Regulatory basis: Swedish AML law (Lag om åtgärder mot penningtvätt 2017:630)
 * requires obligated entities to monitor for and report unusual/large
 * transactions to Finanspolisen.  The threshold for enhanced due diligence
 * and potential Suspicious Transaction Report (STR) filing is €10,000
 * (≈ $10,900 USD at typical rates).
 *
 * This record is immutable — never delete or modify flags once created.
 * They form part of the compliance audit trail (5-year retention required).
 */
@Entity()
export class AmlFlag {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Wallet address of the user who triggered the flag. */
  @Column({ type: "varchar" })
  userAddress: string;

  /** Approximate USD value of the transaction at the time of the flag. */
  @Column({ type: "decimal", precision: 18, scale: 2 })
  amountUsd: number;

  /** Category of transaction that triggered the flag. */
  @Column({ type: "varchar", length: 30 })
  txType: "withdrawal" | "purchase" | "transfer";

  /**
   * Free-form JSON context supplied by the caller (gameId, amount in native
   * units, ledger entry ID, etc.) for investigator review.
   */
  @Column({ type: "jsonb", nullable: true })
  context: Record<string, unknown> | null;

  @CreateDateColumn()
  flaggedAt: Date;

  /**
   * Whether this flag has been reviewed by a compliance officer / MLRO.
   * Default false — all new flags require review.
   */
  @Column({ default: false })
  reviewed: boolean;

  /** Reviewer notes (populated after MLRO review). */
  @Column({ type: "text", nullable: true })
  reviewNotes: string | null;
}
