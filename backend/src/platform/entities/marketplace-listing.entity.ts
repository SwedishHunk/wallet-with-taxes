import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Game } from "./game.entity";
import { GamePlayer } from "./game-player.entity";
import { NFTInstance } from "./nft-instance.entity";

export type ListingStatus = "active" | "sold" | "cancelled";

@Entity({ name: "marketplace_listings" })
export class MarketplaceListing {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Game, { nullable: false })
  game: Game;

  @ManyToOne(() => GamePlayer, { nullable: false })
  seller: GamePlayer;

  @ManyToOne(() => NFTInstance, { nullable: false })
  nftInstance: NFTInstance;

  @Column({ type: "decimal", precision: 18, scale: 8 })
  askPrice: string;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: ListingStatus;

  @ManyToOne(() => GamePlayer, { nullable: true })
  buyer?: GamePlayer | null;

  @Column({ type: "timestamptz", nullable: true })
  soldAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
