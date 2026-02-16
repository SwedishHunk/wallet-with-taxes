import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTxGroupIdToLedgerEntries1729445700000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add txGroupId column as nullable first
    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD COLUMN "txGroupId" uuid`,
    );

    // Add counterpartyUserId column
    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD COLUMN "counterpartyUserId" uuid`,
    );

    // Backfill txGroupId with unique values per row using gen_random_uuid()
    await queryRunner.query(
      `UPDATE ledger_entries SET "txGroupId" = gen_random_uuid() WHERE "txGroupId" IS NULL`,
    );

    // Make txGroupId NOT NULL
    await queryRunner.query(
      `ALTER TABLE ledger_entries ALTER COLUMN "txGroupId" SET NOT NULL`,
    );

    // Add index on txGroupId for efficient lookup
    await queryRunner.query(
      `CREATE INDEX idx_ledger_tx_group_id ON ledger_entries ("txGroupId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ledger_tx_group_id`);

    // Drop columns
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP COLUMN IF EXISTS "counterpartyUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP COLUMN IF EXISTS "txGroupId"`,
    );
  }
}
