import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class TokenShopSyncState {
  @PrimaryColumn({ type: "varchar" })
  id: string;

  @Column({ type: "bigint", default: "0" })
  lastSyncedBlock: string;
}
