import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum EconomicScopeType {
  GLOBAL = "global",
  STUDIO = "studio",
  GAME = "game",
}

export enum EconomicDirection {
  IN = "in",
  OUT = "out",
  NEUTRAL = "neutral",
}

@Entity({ name: "economic_events" })
export class EconomicEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  source: string;

  @Column()
  eventType: string;

  @Column({ type: "enum", enum: EconomicScopeType })
  scopeType: EconomicScopeType;

  @Column({ nullable: true })
  studioId: string | null;

  @Column({ nullable: true })
  gameId: string | null;

  @Column({ nullable: true })
  userId: string | null;

  @Column({ nullable: true })
  gamePlayerId: string | null;

  @Column({ nullable: true })
  walletAddress: string | null;

  @Column()
  assetKey: string;

  @Column({ nullable: true })
  assetSymbol: string | null;

  @Column({ type: "decimal", precision: 36, scale: 18, default: "0" })
  amount: string;

  @Column({ type: "enum", enum: EconomicDirection })
  direction: EconomicDirection;

  @Column({ type: "varchar", nullable: true })
  txHash: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "timestamp" })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
