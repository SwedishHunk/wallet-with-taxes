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
@Index("uq_ledger_intent_id_not_null", ["intentId"], {
  unique: true,
  where: `"intentId" IS NOT NULL`,
})
@Index("uq_ledger_operation_key_not_null", ["operationKey"], {
  unique: true,
  where: `"operationKey" IS NOT NULL`,
})
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

  @Column({ type: "uuid", nullable: true })
  intentId?: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  operationKey?: string | null;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  txHash?: string;

  @CreateDateColumn()
  createdAt: Date;
}
