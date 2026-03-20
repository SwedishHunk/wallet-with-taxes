import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlayerWalletIdentity1763702000000
  implements MigrationInterface
{
  name = "AddPlayerWalletIdentity1763702000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player_wallet_identities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletAddress" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_player_wallet_identities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_player_wallet_identities_wallet_address" UNIQUE ("walletAddress")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "game_players"
      ADD COLUMN "walletIdentityId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "game_players"
      ADD CONSTRAINT "FK_game_players_wallet_identity"
      FOREIGN KEY ("walletIdentityId")
      REFERENCES "player_wallet_identities"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_game_players_wallet_identity_game_not_null"
      ON "game_players" ("walletIdentityId", "gameId")
      WHERE "walletIdentityId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."uq_game_players_wallet_identity_game_not_null"
    `);
    await queryRunner.query(`
      ALTER TABLE "game_players"
      DROP CONSTRAINT "FK_game_players_wallet_identity"
    `);
    await queryRunner.query(`
      ALTER TABLE "game_players"
      DROP COLUMN "walletIdentityId"
    `);
    await queryRunner.query(`
      DROP TABLE "player_wallet_identities"
    `);
  }
}
