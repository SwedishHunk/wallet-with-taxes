import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { StudioMember } from "../platform/entities/studio-member.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: "varchar" })
  custodyMode: "custodial" | "self";

  @Column({ type: "text", nullable: true })
  encryptedPrivateKey: string | null;

  @Column()
  walletAddress: string;

  @Column({ type: "varchar", default: "pending" })
  kycStatus: "pending" | "verified" | "rejected";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  onChainWallet: string;

  @Column({ default: false })
  isAdmin: boolean;

  @OneToMany(() => StudioMember, (member) => member.user, { cascade: true })
  studioMemberships: StudioMember[];
}
