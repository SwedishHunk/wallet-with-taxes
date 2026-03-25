import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxCostBasis } from "./entities/tax-cost-basis.entity";
import { TaxProjectionState } from "./entities/tax-projection-state.entity";
import { ApiTaxController, TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";
import { ExchangeRateService } from "./exchange-rate.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TaxEvent, TaxCostBasis, TaxProjectionState]),
  ],
  controllers: [TaxController, ApiTaxController],
  providers: [TaxService, ExchangeRateService],
  exports: [TaxService, ExchangeRateService],
})
export class TaxModule {}
