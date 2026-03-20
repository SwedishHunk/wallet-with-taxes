import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLedgerOperationKey1763700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS "operationKey" varchar(128)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_operation_key_not_null ON ledger_entries ("operationKey") WHERE "operationKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_ledger_operation_key_not_null`,
    );
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP COLUMN IF EXISTS "operationKey"`,
    );
  }
}
