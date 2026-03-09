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

  @Column({ type: "varchar", nullable: true })
  source?: string | null;

  @Column({ type: "varchar", nullable: true })
  txHash?: string | null;

  @Column({ type: "int", nullable: true })
  logIndex?: number | null;
}
