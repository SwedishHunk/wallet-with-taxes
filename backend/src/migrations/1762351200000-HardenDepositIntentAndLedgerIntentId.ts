import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenDepositIntentAndLedgerIntentId1762351200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'wallet_deposit_intent_status_enum'
        ) THEN
          CREATE TYPE wallet_deposit_intent_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `ALTER TABLE wallet_deposit_intents ALTER COLUMN status DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE wallet_deposit_intents
      ALTER COLUMN status TYPE wallet_deposit_intent_status_enum
      USING (
        CASE
          WHEN status IN ('PENDING', 'CONFIRMED', 'EXPIRED')
            THEN status::wallet_deposit_intent_status_enum
          ELSE 'PENDING'::wallet_deposit_intent_status_enum
        END
      )
    `);
    await queryRunner.query(
      `ALTER TABLE wallet_deposit_intents ALTER COLUMN status SET DEFAULT 'PENDING'`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_deposit_intents_tx_hash_not_null ON wallet_deposit_intents ("txHash") WHERE "txHash" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS "intentId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ledger_intent_id ON ledger_entries ("intentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ledger_intent_id`);
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP COLUMN IF EXISTS "intentId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_wallet_deposit_intents_tx_hash_not_null`,
    );

    await queryRunner.query(
      `ALTER TABLE wallet_deposit_intents ALTER COLUMN status DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE wallet_deposit_intents
      ALTER COLUMN status TYPE varchar
      USING status::text
    `);
    await queryRunner.query(
      `ALTER TABLE wallet_deposit_intents ALTER COLUMN status SET DEFAULT 'PENDING'`,
    );

    await queryRunner.query(
      `DROP TYPE IF EXISTS wallet_deposit_intent_status_enum`,
    );
  }
}
