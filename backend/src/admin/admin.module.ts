import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { TaxModule } from "../tax/tax.module";
import { User } from "../users/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([TaxEvent, User]), TaxModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
