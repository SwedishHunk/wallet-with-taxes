import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Replace the full unique index on (source, txHash, logIndex) with a partial
 * unique index that only applies when all three columns are NOT NULL.
 *
 * Why: PostgreSQL considers NULL != NULL, so the original full unique index
 * never deduplicated rows where any of the three columns is NULL (e.g. off-chain
 * rewards or manual entries). On-chain events always carry all three values and
 * are now correctly deduplicated at the DB level.
 */
export class PartialIndexTaxEventDedup1763706000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old auto-named full unique index (TypeORM names it IDX_<hash>).
    // We find it dynamically so this migration is robust to any auto-generated name.
    await queryRunner.query(`
      DO $$
      DECLARE idx_name TEXT;
      BEGIN
        SELECT indexname INTO idx_name
        FROM pg_indexes
        WHERE tablename = 'tax_event'
          AND indexdef ILIKE '%"source"%"txHash"%"logIndex"%'
          AND indexdef ILIKE '%unique%'
          AND indexname <> 'UQ_tax_event_dedup';
        IF idx_name IS NOT NULL THEN
          EXECUTE 'DROP INDEX IF EXISTS "' || idx_name || '"';
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_event_dedup"
      ON "tax_event" ("source", "txHash", "logIndex")
      WHERE "source" IS NOT NULL
        AND "txHash" IS NOT NULL
        AND "logIndex" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tax_event_dedup"`);
    // Restore the original full unique index behaviour
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_event_dedup_legacy"
      ON "tax_event" ("source", "txHash", "logIndex")
    `);
  }
}
