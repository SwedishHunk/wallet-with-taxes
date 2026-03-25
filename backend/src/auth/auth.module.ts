import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "./jwt.strategy";
import { SuspensionCacheService } from "./suspension-cache.service";
import { User } from "../users/user.entity";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([User]), // needed by JwtStrategy for suspension check
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>("JWT_SECRET");
        if (!jwtSecret) {
          throw new Error("JWT_SECRET environment variable is required");
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: "1d" },
        };
      },
    }),
  ],
  providers: [JwtStrategy, SuspensionCacheService],
  exports: [JwtModule, PassportModule, SuspensionCacheService],
})
export class AuthModule {}
