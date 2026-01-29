import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { GamePlayer } from "./game-player.entity";

@Entity({ name: "game_wallets" })
export class GameWallet {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GamePlayer, { nullable: false })
  gamePlayer: GamePlayer;

  @Column({ type: "decimal", precision: 30, scale: 8, default: 0 })
  balance: string;

  @Column({ type: "decimal", precision: 30, scale: 8, default: 0 })
  totalDeposited: string;

  @Column({ type: "decimal", precision: 30, scale: 8, default: 0 })
  totalWithdrawn: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
