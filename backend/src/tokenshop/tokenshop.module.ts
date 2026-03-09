import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { TaxModule } from "../tax/tax.module";
import { TokenShopSyncState } from "./entities/tokenshop-sync-state.entity";
import { TokenShopListenerService } from "./tokenshop-listener.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TaxEvent, TokenShopSyncState]),
    TaxModule,
  ],
  providers: [TokenShopListenerService],
})
export class TokenShopModule {}
