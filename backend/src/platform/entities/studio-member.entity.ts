import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Studio } from "./studio.entity";

export enum StudioRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

/**
 * Permission bitmask values - used for BIGINT storage in Postgres
 * Each permission is a bit position
 */
export const PermissionBitMask = {
  ManageMembers: 1n,
  ManageGames: 2n,
  ManageSettings: 4n,
  MintNFT: 8n,
  MakeTransactions: 16n,
} as const;

export type PermissionBitMask = bigint;

/**
 * Transformer för BIGINT ↔ string konvertering
 * Postgres BIGINT lagras som string, vi konverterar via BigInt()
 *
 * to: TS bigint → Postgres BIGINT (som string)
 * from: Postgres BIGINT (string) → TS bigint
 */
const bigintTransformer: ValueTransformer = {
  to: (value: bigint | null | undefined) => {
    if (value === null || value === undefined) {
      return "0";
    }
    // Lagra som string för Postgres BIGINT
    return value.toString();
  },
  from: (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return 0n;
    }
    try {
      return BigInt(value);
    } catch (error) {
      console.error(`Invalid BIGINT value: ${value}`, error);
      return 0n;
    }
  },
};

@Entity({ name: "studio_members" })
@Index(["studio", "user"], { unique: true })
export class StudioMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Studio, (studio) => studio.members, { onDelete: "CASCADE" })
  studio: Studio;

  @ManyToOne(() => User, (user) => user.studioMemberships, {
    onDelete: "CASCADE",
  })
  user: User;

  /**
   * Owner-status: IMMUTABLE via normal admin-flöde
   * Kan bara ändras av annan Owner via dedikerad endpoint
   * En Studio måste ALLTID ha minst en Owner
   */
  @Column({ default: false })
  isOwner: boolean;

  @Column({ type: "enum", enum: StudioRole, default: StudioRole.MEMBER })
  role: StudioRole;

  /**
   * Permissions som BIGINT bitmask med säker konvertering
   * Lagras som BIGINT i Postgres, hanteras som TS bigint i kod
   * Varje bit representerar en permission
   * Ex: 31n = alla permissions (11111 i binärt)
   *
   * Transformer hanterar string ↔ bigint konvertering från Postgres
   */
  @Column({ type: "bigint", default: "0", transformer: bigintTransformer })
  permissionsMask: bigint;

  /**
   * Per-game access: vilka Games kan denna medlem komma åt?
   * UUID-array för Postgres
   */
  @Column({ type: "uuid", array: true, default: () => "'{}'" })
  gameAccessIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
