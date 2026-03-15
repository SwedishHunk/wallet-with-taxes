import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminAuditLog1762354000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "adminId" VARCHAR NOT NULL,
        "adminEmail" VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        "targetType" VARCHAR NOT NULL,
        "targetId" VARCHAR,
        details JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_audit_log`);
  }
}
