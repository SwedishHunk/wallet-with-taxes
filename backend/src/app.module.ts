import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "./users/users.module";
import { WalletsModule } from "./wallets/wallets.module";
// import { MarketplaceModule } from "./marketplace/marketplace.module";
import { TaxModule } from "./tax/tax.module";
import { PaymentsModule } from "./__payments/payments.module";
import { AssetsModule } from "./__assets/assets.module";
import { EventsModule } from "./__events/events.module";
import { AdminModule } from "./admin/admin.module";
import { PlatformModule } from "./platform/platform.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      synchronize: true,
      autoLoadEntities: true,
    }),
    UsersModule,
    WalletsModule,
    // MarketplaceModule, // Temporarily disabled - has TypeScript errors
    TaxModule,
    PaymentsModule,
    AssetsModule,
    EventsModule,
    AdminModule,
    PlatformModule,
  ],
})
export class AppModule {}
