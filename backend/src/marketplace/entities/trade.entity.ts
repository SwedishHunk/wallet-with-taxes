// src/marketplace/entities/trade.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
@Entity()
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  buyerId: number;

  @Column()
  sellerId: number;

  @Column()
  listingId: number;

  @Column("decimal")
  amount: number;

  @Column("decimal")
  totalPrice: number;

  @Column("decimal")
  feeUSD: number;

  @Column({ default: "pending" })
  status: "pending" | "confirmed" | "failed";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
