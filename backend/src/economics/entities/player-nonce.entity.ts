import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * Persists one-time wallet authentication nonces in Postgres.
 * Replaces the previous in-memory Map, enabling horizontal scaling —
 * any application instance can verify a nonce issued by any other instance.
 *
 * Key format: "<walletAddress>:<purpose>:<nonce>"
 * Rows are consumed (deleted) immediately on successful verification.
 * Expired rows are cleaned up probabilistically during issueNonce() calls.
 */
@Entity({ name: "player_nonce" })
export class PlayerNonce {
  @PrimaryColumn({ type: "varchar" })
  key: string;

  @Column({ type: "varchar" })
  walletAddress: string;

  @Column({ type: "varchar" })
  purpose: string;

  @Column({ type: "varchar", nullable: true })
  gameId: string | null;

  @Column({ type: "varchar" })
  nonce: string;

  @Column({ type: "text" })
  message: string;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;
}
