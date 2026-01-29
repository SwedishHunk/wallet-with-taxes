import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GameWallet } from "./game-wallet.entity";

@Entity({ name: "ledger_entries" })
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GameWallet, { nullable: false })
  wallet: GameWallet;

  @Column({ type: "varchar" })
  type:
    | "deposit"
    | "withdraw"
    | "spend"
    | "earn"
    | "transfer"
    | "upkeep"
    | "mint";

  @Column({ type: "decimal", precision: 30, scale: 8 })
  amount: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  txHash?: string;

  @CreateDateColumn()
  createdAt: Date;
}
