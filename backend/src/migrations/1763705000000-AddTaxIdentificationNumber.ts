import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * DAC8 / CARF compliance: adds `tax_identification_number` to the `user` table.
 *
 * EU Regulation 2023/2226 (DAC8) requires crypto-asset service providers to
 * collect and report users' national tax identification numbers (TINs) once
 * platform-wide reporting thresholds are exceeded.  This field stores the
 * national TIN collected during the KYC step (Swedish personnummer for SE
 * residents, equivalent national ID for other EU residents).
 *
 * Column is nullable: existing users pre-KYC will have NULL until they
 * complete identity verification.
 */
export class AddTaxIdentificationNumber1763705000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "taxIdentificationNumber" varchar NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "taxIdentificationNumber"`,
    );
  }
}
