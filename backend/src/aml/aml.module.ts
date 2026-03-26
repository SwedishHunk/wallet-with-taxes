import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AmlFlag } from "./aml-flag.entity";
import { AmlMonitorService } from "./aml-monitor.service";

@Module({
  imports: [TypeOrmModule.forFeature([AmlFlag])],
  providers: [AmlMonitorService],
  exports: [AmlMonitorService],
})
export class AmlModule {}
