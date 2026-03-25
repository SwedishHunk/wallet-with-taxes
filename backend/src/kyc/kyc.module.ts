import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KycService } from "./kyc.service";
import { KycController } from "./kyc.controller";
import { User } from "../users/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
