import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxCostBasis } from "./entities/tax-cost-basis.entity";
import { ApiTaxController, TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [TypeOrmModule.forFeature([TaxEvent, TaxCostBasis])],
  controllers: [TaxController, ApiTaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
