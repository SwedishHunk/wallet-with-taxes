import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { TaxModule } from "../tax/tax.module";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopAdminController } from "./tokenshop-admin.controller";
import { TokenShopAnalyticsController } from "./tokenshop-analytics.controller";
import { TokenShopAnalyticsService } from "./tokenshop-analytics.service";
import { TokenShopAdminService } from "./tokenshop-admin.service";
import { TokenShopChainService } from "./tokenshop-chain.service";
import { TokenShopSyncState } from "./entities/tokenshop-sync-state.entity";
import { TokenShopQuotesController } from "./tokenshop-quotes.controller";
import { TokenShopQueryService } from "./tokenshop-query.service";
import { TokenShopShopController } from "./tokenshop-shop.controller";
import { TokenShopSyncController } from "./tokenshop-sync.controller";
import { TokenShopUserController } from "./tokenshop-user.controller";
import { TokenShopAdminApiGuard } from "./guards/tokenshop-admin-api.guard";
import { TokenShopListenerService } from "./tokenshop-listener.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TaxEvent, TokenShopSyncState, ShopEvent]),
    TaxModule,
  ],
  controllers: [
    TokenShopShopController,
    TokenShopQuotesController,
    TokenShopAnalyticsController,
    TokenShopUserController,
    TokenShopAdminController,
    TokenShopSyncController,
  ],
  providers: [
    TokenShopChainService,
    TokenShopQueryService,
    TokenShopAnalyticsService,
    TokenShopAdminService,
    TokenShopAdminApiGuard,
    TokenShopListenerService,
  ],
})
export class TokenShopModule {}
