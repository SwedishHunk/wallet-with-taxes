import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "tax_projection_state" })
export class TaxProjectionState {
  @PrimaryColumn({ type: "varchar", length: 80 })
  projector: string;

  @Column({ type: "boolean", default: true })
  healthy: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastError: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastFailureAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastSuccessAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
