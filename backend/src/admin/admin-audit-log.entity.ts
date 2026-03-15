import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "admin_audit_log" })
export class AdminAuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  adminId: string;

  @Column({ type: "varchar" })
  adminEmail: string;

  @Column({ type: "varchar" })
  action: string;

  @Column({ type: "varchar" })
  targetType: string;

  @Column({ type: "varchar", nullable: true })
  targetId: string;

  @Column({ type: "jsonb", nullable: true })
  details: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
