import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNftPurchaseOperationKey1763701000000
  implements MigrationInterface
{
  name = "AddNftPurchaseOperationKey1763701000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nft_instances"
      ADD COLUMN "purchaseOperationKey" character varying(120)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_nft_purchase_operation_key_not_null"
      ON "nft_instances" ("purchaseOperationKey")
      WHERE "purchaseOperationKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."uq_nft_purchase_operation_key_not_null"
    `);
    await queryRunner.query(`
      ALTER TABLE "nft_instances"
      DROP COLUMN "purchaseOperationKey"
    `);
  }
}
