import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletLedgerConstraints1729445600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add CHECK constraint for ledger_entries.amount > 0
    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_amount_positive CHECK (amount > 0)`,
    );

    // Add CHECK constraint for ledger_entries.type
    await queryRunner.query(
      `ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_type_valid CHECK (type IN ('deposit', 'withdraw', 'spend', 'earn', 'transfer', 'upkeep', 'mint'))`,
    );

    // Add CHECK constraints for game_wallets
    await queryRunner.query(
      `ALTER TABLE game_wallets ADD CONSTRAINT chk_wallet_balance_non_negative CHECK (balance >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE game_wallets ADD CONSTRAINT chk_wallet_total_deposited_non_negative CHECK ("totalDeposited" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE game_wallets ADD CONSTRAINT chk_wallet_total_withdrawn_non_negative CHECK ("totalWithdrawn" >= 0)`,
    );

    // Add index for wallet_id + createdAt on ledger_entries for efficient querying
    await queryRunner.query(
      `CREATE INDEX idx_ledger_wallet_created ON ledger_entries (wallet_id, "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ledger_wallet_created`);

    // Drop CHECK constraints
    await queryRunner.query(
      `ALTER TABLE game_wallets DROP CONSTRAINT IF EXISTS chk_wallet_total_withdrawn_non_negative`,
    );
    await queryRunner.query(
      `ALTER TABLE game_wallets DROP CONSTRAINT IF EXISTS chk_wallet_total_deposited_non_negative`,
    );
    await queryRunner.query(
      `ALTER TABLE game_wallets DROP CONSTRAINT IF EXISTS chk_wallet_balance_non_negative`,
    );
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_type_valid`,
    );
    await queryRunner.query(
      `ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_amount_positive`,
    );
  }
}
