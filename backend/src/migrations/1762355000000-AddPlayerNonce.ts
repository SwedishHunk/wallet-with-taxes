import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlayerNonce1762355000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS "player_nonce" (
        "key"           VARCHAR        NOT NULL PRIMARY KEY,
        "walletAddress" VARCHAR        NOT NULL,
        "purpose"       VARCHAR        NOT NULL,
        "gameId"        VARCHAR,
        "nonce"         VARCHAR        NOT NULL,
        "message"       TEXT           NOT NULL,
        "expiresAt"     TIMESTAMPTZ    NOT NULL
      )
    `);

    await runner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_player_nonce_expiresAt"
      ON "player_nonce" ("expiresAt")
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS "player_nonce"`);
  }
}
