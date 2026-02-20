import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxService } from "./tax.service";

@Module({
  imports: [TypeOrmModule.forFeature([TaxEvent])],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
