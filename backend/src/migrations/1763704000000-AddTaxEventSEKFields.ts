import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxEventSEKFields1763704000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tax_event"
       ADD COLUMN IF NOT EXISTS "priceSEK" float,
       ADD COLUMN IF NOT EXISTS "exchangeRateSEKUSD" float,
       ADD COLUMN IF NOT EXISTS "exchangeRateSource" varchar(60),
       ADD COLUMN IF NOT EXISTS "taxTreatment" varchar(20) NOT NULL DEFAULT 'unknown'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tax_event"
       DROP COLUMN IF EXISTS "priceSEK",
       DROP COLUMN IF EXISTS "exchangeRateSEKUSD",
       DROP COLUMN IF EXISTS "exchangeRateSource",
       DROP COLUMN IF EXISTS "taxTreatment"`,
    );
  }
}
