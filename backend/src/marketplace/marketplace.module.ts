import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Listing } from "./entities/listing.entity";
import { Trade } from "./entities/trade.entity";

/**
 * MarketplaceModule registers the Listing and Trade entities with TypeORM.
 * Controller and service implementation is pending — this stub ensures the
 * entities are included in the schema and the module compiles cleanly.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Listing, Trade])],
  exports: [TypeOrmModule],
})
export class MarketplaceModule {}
