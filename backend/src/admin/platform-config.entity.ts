import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "platform_config" })
export class PlatformConfig {
  @PrimaryColumn({ type: "varchar" })
  key: string;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  value: number;
}
