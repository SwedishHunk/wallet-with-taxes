import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { StudioMember } from "./studio-member.entity";
import { StudioUser } from "./studio-user.entity";

@Entity({ name: "studios" })
export class Studio {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => StudioMember, (member) => member.studio, { cascade: true })
  members: StudioMember[];

  @OneToMany(() => StudioUser, (studioUser) => studioUser.studio, { cascade: true })
  studioUsers: StudioUser[];

  @Column({ nullable: true })
  walletAddress?: string;

  @Column({ type: "varchar", default: "active" })
  status: "active" | "suspended";

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
