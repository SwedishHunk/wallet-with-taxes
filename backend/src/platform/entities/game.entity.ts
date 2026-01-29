import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Studio } from "./studio.entity";

@Entity({ name: "games" })
export class Game {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Studio, { nullable: false })
  studio: Studio;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  contractAddress?: string;

  @Column({ type: "varchar", default: "active" })
  status: "active" | "inactive";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
