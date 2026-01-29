import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { NFTTemplate } from "./nft-template.entity";
import { GamePlayer } from "./game-player.entity";

@Entity({ name: "nft_instances" })
@Index(["owner", "template"])
@Index(["tokenId", "contractAddress"], {
  unique: true,
  where: '"tokenId" IS NOT NULL',
})
export class NFTInstance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => NFTTemplate, { nullable: false })
  template: NFTTemplate;

  @ManyToOne(() => GamePlayer, { nullable: false })
  owner: GamePlayer;

  // On-chain reference (for hybrid NFTs)
  @Column({ type: "varchar", length: 100, nullable: true })
  contractAddress?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  tokenId?: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  txHash?: string;

  // Standard attributes (common across all games/NFTs)
  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl?: string;

  @Column({ type: "int", default: 1 })
  level: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 100 })
  condition: number; // 0-100, durability/health of the NFT

  @Column({ type: "int", default: 0 })
  power: number; // Generic strength/value stat

  // Custom attributes (game-specific, defined by studio)
  @Column({ type: "jsonb", default: {} })
  customAttributes: Record<string, any>;

  // Inventory/usage state
  @Column({ default: false })
  equipped: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastUpkeepPaid?: Date;

  @Column({ type: "timestamptz", nullable: true })
  nextUpkeepDue?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
