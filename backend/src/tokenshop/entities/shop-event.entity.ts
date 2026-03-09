import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "shop_events" })
@Unique(["txHash", "logIndex"])
export class ShopEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: "varchar" })
  type: "BUY" | "SELL";

  @Index()
  @Column({ type: "int" })
  blockNumber: number;

  @Column({ type: "varchar" })
  txHash: string;

  @Column({ type: "int" })
  logIndex: number;

  @Index()
  @Column({ type: "varchar" })
  user: string;

  @Index()
  @Column({ type: "varchar" })
  asset: string;

  @Column({ type: "varchar", default: "" })
  assetSymbol: string;

  @Column({ type: "varchar", default: "0" })
  amountIn: string;

  @Column({ type: "varchar", default: "0" })
  amountOut: string;

  @CreateDateColumn()
  createdAt: Date;
}
