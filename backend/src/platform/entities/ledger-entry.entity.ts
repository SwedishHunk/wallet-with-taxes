import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Check,
  Index,
} from "typeorm";
import { GameWallet } from "./game-wallet.entity";

@Entity({ name: "ledger_entries" })
@Check(`amount > 0`)
@Check(
  `type IN ('deposit', 'withdraw', 'spend', 'earn', 'transfer', 'upkeep', 'mint')`,
)
@Index("idx_ledger_tx_group_id", ["txGroupId"])
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GameWallet, { nullable: false })
  wallet: GameWallet;

  @Column({ type: "uuid" })
  txGroupId: string;

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

  @Column({ type: "uuid", nullable: true })
  counterpartyUserId?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  txHash?: string;

  @CreateDateColumn()
  createdAt: Date;
}
