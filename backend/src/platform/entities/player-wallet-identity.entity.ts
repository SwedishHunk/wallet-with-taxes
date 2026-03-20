import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { GamePlayer } from "./game-player.entity";

@Entity({ name: "player_wallet_identities" })
export class PlayerWalletIdentity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", unique: true })
  walletAddress: string;

  @OneToMany(() => GamePlayer, (gamePlayer) => gamePlayer.walletIdentity)
  gamePlayers: GamePlayer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
