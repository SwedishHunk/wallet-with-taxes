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
import { TokenShopModule } from "./tokenshop/tokenshop.module";
import { EconomicsModule } from "./economics/economics.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host:
        process.env.NODE_ENV === "test"
          ? process.env.TEST_DATABASE_HOST
          : process.env.DATABASE_HOST,
      port: Number(
        process.env.NODE_ENV === "test"
          ? process.env.TEST_DATABASE_PORT
          : process.env.DATABASE_PORT,
      ),
      username:
        process.env.NODE_ENV === "test"
          ? process.env.TEST_DATABASE_USER
          : process.env.DATABASE_USER,
      password:
        process.env.NODE_ENV === "test"
          ? process.env.TEST_DATABASE_PASSWORD
          : process.env.DATABASE_PASSWORD,
      database:
        process.env.NODE_ENV === "test"
          ? process.env.TEST_DATABASE_NAME
          : process.env.DATABASE_NAME,
      synchronize: true,
      autoLoadEntities: true,
      dropSchema: process.env.NODE_ENV === "test" ? true : false,
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
    TokenShopModule,
    EconomicsModule,
  ],
})
export class AppModule {}
