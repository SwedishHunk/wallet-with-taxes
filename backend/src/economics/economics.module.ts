import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EconomicEvent } from "./entities/economic-event.entity";
import { EconomicsService } from "./economics.service";

@Module({
  imports: [TypeOrmModule.forFeature([EconomicEvent])],
  providers: [EconomicsService],
  exports: [EconomicsService, TypeOrmModule],
})
export class EconomicsModule {}
