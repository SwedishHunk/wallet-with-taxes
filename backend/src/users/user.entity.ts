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

  @Column({ type: "varchar", nullable: true })
  onChainWallet: string | null;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isSuspended: boolean;

  /**
   * GDPR Article 7 — timestamp of explicit consent at registration.
   * Null for users created before consent capture was introduced.
   */
  @Column({ type: "timestamptz", nullable: true })
  consentGivenAt: Date | null;

  /**
   * Timestamp of the user's most recent successful login.
   * Used by the GDPR data-retention job to detect inactive accounts.
   * Null for users who have never logged in since this field was added.
   */
  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => StudioMember, (member) => member.user, { cascade: true })
  studioMemberships: StudioMember[];
}
