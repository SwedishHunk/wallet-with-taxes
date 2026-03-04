import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Game } from "./game.entity";
import { User } from "../../users/user.entity";

export enum WalletDepositIntentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  EXPIRED = "EXPIRED",
}

@Entity({ name: "wallet_deposit_intents" })
@Index("idx_wallet_deposit_intents_game_status", ["game", "status"])
@Index("uq_wallet_deposit_intents_tx_hash_not_null", ["txHash"], {
  unique: true,
  where: `"txHash" IS NOT NULL`,
})
export class WalletDepositIntent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Game, { nullable: false })
  game: Game;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column({ type: "decimal", precision: 30, scale: 8 })
  amount: string;

  @Column({ type: "varchar", length: 66 })
  depositAddress: string;

  @Column({
    type: "enum",
    enum: WalletDepositIntentStatus,
    enumName: "wallet_deposit_intent_status_enum",
    default: WalletDepositIntentStatus.PENDING,
  })
  status: WalletDepositIntentStatus;

  @Column({ type: "varchar", nullable: true })
  txHash?: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  confirmedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
