import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
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

const isTestEnv = process.env.NODE_ENV === "test";
const shouldSynchronizeSchema =
  isTestEnv || process.env.TYPEORM_SYNCHRONIZE === "true";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: isTestEnv ? ".env.test" : ".env",
    }),
    ThrottlerModule.forRoot([
      {
        name: "auth",
        ttl: 60000, // 1 minute window
        limit: 10, // max 10 requests per minute per IP
      },
    ]),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: isTestEnv
        ? process.env.TEST_DATABASE_HOST
        : process.env.DATABASE_HOST,
      port: Number(
        isTestEnv ? process.env.TEST_DATABASE_PORT : process.env.DATABASE_PORT,
      ),
      username: isTestEnv
        ? process.env.TEST_DATABASE_USER
        : process.env.DATABASE_USER,
      password: isTestEnv
        ? process.env.TEST_DATABASE_PASSWORD
        : process.env.DATABASE_PASSWORD,
      database: isTestEnv
        ? process.env.TEST_DATABASE_NAME
        : process.env.DATABASE_NAME,
      synchronize: shouldSynchronizeSchema,
      autoLoadEntities: true,
      dropSchema: isTestEnv ? true : false,
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
