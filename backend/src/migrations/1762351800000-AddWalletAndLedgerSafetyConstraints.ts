import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletAndLedgerSafetyConstraints1762351800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const duplicateWallets = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT game_player_id
        FROM game_wallets
        GROUP BY game_player_id
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const duplicateWalletCount = Number(duplicateWallets?.[0]?.count ?? 0);
    if (duplicateWalletCount > 0) {
      throw new Error(
        `Cannot apply unique wallet constraint: found ${duplicateWalletCount} duplicated game_player_id values in game_wallets.`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const duplicateIntents = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT "intentId"
        FROM ledger_entries
        WHERE "intentId" IS NOT NULL
        GROUP BY "intentId"
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const duplicateIntentCount = Number(duplicateIntents?.[0]?.count ?? 0);
    if (duplicateIntentCount > 0) {
      throw new Error(
        `Cannot apply unique intentId constraint: found ${duplicateIntentCount} duplicated non-null intentId values in ledger_entries.`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_game_wallets_game_player_id ON game_wallets (game_player_id)`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS idx_ledger_intent_id`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_intent_id_not_null ON ledger_entries ("intentId") WHERE "intentId" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_deposit_ledger_metadata_defaults()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.type = 'deposit' THEN
          IF NEW."intentId" IS NULL THEN
            NEW."intentId" := gen_random_uuid();
          END IF;
          IF NEW."txHash" IS NULL THEN
            NEW."txHash" := 'internal:' || NEW."txGroupId"::text;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_set_deposit_ledger_metadata_defaults ON ledger_entries;
      CREATE TRIGGER trg_set_deposit_ledger_metadata_defaults
      BEFORE INSERT OR UPDATE OF type, "intentId", "txHash", "txGroupId"
      ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION set_deposit_ledger_metadata_defaults();
    `);

    await queryRunner.query(`
      UPDATE ledger_entries
      SET
        "intentId" = COALESCE("intentId", gen_random_uuid()),
        "txHash" = COALESCE("txHash", 'internal:' || "txGroupId"::text)
      WHERE type = 'deposit'
    `);

    await queryRunner.query(`
      ALTER TABLE ledger_entries
      ADD CONSTRAINT chk_ledger_deposit_requires_txhash_intentid
      CHECK (
        type <> 'deposit' OR ("intentId" IS NOT NULL AND "txHash" IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ledger_entries
      DROP CONSTRAINT IF EXISTS chk_ledger_deposit_requires_txhash_intentid
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_set_deposit_ledger_metadata_defaults ON ledger_entries
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS set_deposit_ledger_metadata_defaults`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_ledger_intent_id_not_null`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ledger_intent_id ON ledger_entries ("intentId")`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_game_wallets_game_player_id`,
    );
  }
}
