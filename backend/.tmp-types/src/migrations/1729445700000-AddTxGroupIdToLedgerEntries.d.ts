import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddTxGroupIdToLedgerEntries1729445700000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
