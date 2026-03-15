import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminActions1762353000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isSuspended" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key VARCHAR PRIMARY KEY,
        value DECIMAL(10, 4) NOT NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO platform_config (key, value)
      VALUES ('platform_fee_percent', 2.5)
      ON CONFLICT (key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform_config`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "isSuspended"`,
    );
  }
}
