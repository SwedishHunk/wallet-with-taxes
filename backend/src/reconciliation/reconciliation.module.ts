import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { LedgerEntry } from "../platform/entities/ledger-entry.entity";
import { User } from "../users/user.entity";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [TypeOrmModule.forFeature([TaxEvent, LedgerEntry, User])],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
