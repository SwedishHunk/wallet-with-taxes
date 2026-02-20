import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

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
}
