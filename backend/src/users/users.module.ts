import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User } from "./user.entity";
import { Studio } from "../platform/entities/studio.entity";
import { StudioMember } from "../platform/entities/studio-member.entity";
import { AuthModule } from "../auth/auth.module";
import { PlatformModule } from "../platform/platform.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Studio, StudioMember]),
    AuthModule,
    PlatformModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
