import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Game } from "./game.entity";
import { StudioUser } from "./studio-user.entity";
import { PlayerWalletIdentity } from "./player-wallet-identity.entity";

@Entity({ name: "game_players" })
@Unique(["studioUser", "game"])
export class GamePlayer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { nullable: true })
  user?: User;

  @ManyToOne(() => StudioUser, (studioUser) => studioUser.gamePlayers, {
    nullable: true,
  })
  studioUser?: StudioUser;

  @ManyToOne(
    () => PlayerWalletIdentity,
    (walletIdentity) => walletIdentity.gamePlayers,
    {
      nullable: true,
    },
  )
  walletIdentity?: PlayerWalletIdentity;

  @ManyToOne(() => Game, { nullable: false })
  game: Game;

  @Column({ type: "int", default: 1 })
  level: number;

  @Column({ type: "int", default: 0 })
  exp: number;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
