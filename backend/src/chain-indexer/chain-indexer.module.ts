import { Module } from "@nestjs/common";
import { ChainIndexerService } from "./chain-indexer.service";
import { TaxModule } from "../tax/tax.module";

@Module({
  imports: [TaxModule],
  providers: [ChainIndexerService],
  exports: [ChainIndexerService],
})
export class ChainIndexerModule {}
