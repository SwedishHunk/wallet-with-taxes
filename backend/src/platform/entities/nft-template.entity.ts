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

@Entity({ name: "nft_templates" })
export class NFTTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Game, { nullable: false })
  game: Game;

  @Column()
  name: string;

  @Column({ type: "int", default: 1 })
  tier: number; // 1-4 recommended

  @Column({ type: "jsonb", default: {} })
  attributes: Record<string, any>;

  @Column({ type: "decimal", precision: 30, scale: 8, default: 0 })
  upkeepCostPerDay: string;

  @Column({ type: "decimal", precision: 30, scale: 8, default: 0 })
  mintingCost: string;

  @Column({ type: "int", nullable: true })
  maxMintCount?: number;

  @Column({ type: "int", default: 0 })
  currentMintCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
