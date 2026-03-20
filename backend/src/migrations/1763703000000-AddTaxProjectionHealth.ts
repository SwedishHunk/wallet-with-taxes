import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxProjectionHealth1763703000000 implements MigrationInterface {
  name = "AddTaxProjectionHealth1763703000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tax_events"
      ADD COLUMN "valuationStatus" character varying(24) NOT NULL DEFAULT 'missing'
    `);

    await queryRunner.query(`
      ALTER TABLE "tax_events"
      ADD COLUMN "valuationSource" character varying(120)
    `);

    await queryRunner.query(`
      CREATE TABLE "tax_projection_state" (
        "projector" character varying(80) NOT NULL,
        "healthy" boolean NOT NULL DEFAULT true,
        "lastError" character varying(255),
        "lastFailureAt" TIMESTAMPTZ,
        "lastSuccessAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tax_projection_state_projector" PRIMARY KEY ("projector")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "tax_projection_state"
    `);

    await queryRunner.query(`
      ALTER TABLE "tax_events"
      DROP COLUMN "valuationSource"
    `);

    await queryRunner.query(`
      ALTER TABLE "tax_events"
      DROP COLUMN "valuationStatus"
    `);
  }
}
