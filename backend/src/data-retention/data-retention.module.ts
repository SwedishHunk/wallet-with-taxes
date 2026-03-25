import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataRetentionService } from "./data-retention.service";
import { User } from "../users/user.entity";
import { TaxEvent } from "../tax/entities/tax-event.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, TaxEvent])],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
