import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Listing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column() sellerId: number;
  @Column() tokenAddress: string;
  @Column() tokenId: number;
  @Column() amount: number;
  @Column("decimal") pricePerUnit: number;
  @Column({ default: "active" }) status: "active" | "sold" | "cancelled";

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
