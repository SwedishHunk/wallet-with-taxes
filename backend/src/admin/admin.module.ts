import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminDevController } from "./admin-dev.controller";
import { AdminDevService } from "./admin-dev.service";
import { AdminService } from "./admin.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { ShopEvent } from "../tokenshop/entities/shop-event.entity";
import { TaxModule } from "../tax/tax.module";
import { User } from "../users/user.entity";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import { EconomicEvent } from "../economics/entities/economic-event.entity";
import { PlatformConfig } from "./platform-config.entity";
import { AdminAuditLog } from "./admin-audit-log.entity";
import { UsersModule } from "../users/users.module";
import { PlatformModule } from "../platform/platform.module";
import { AuthModule } from "../auth/auth.module";
import { EconomicsModule } from "../economics/economics.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxEvent,
      ShopEvent,
      User,
      Studio,
      Game,
      EconomicEvent,
      PlatformConfig,
      AdminAuditLog,
    ]),
    TaxModule,
    AuthModule,
    UsersModule,
    PlatformModule,
    EconomicsModule,
  ],
  controllers: [AdminController, AdminDevController],
  providers: [AdminService, AdminDevService],
})
export class AdminModule {}
