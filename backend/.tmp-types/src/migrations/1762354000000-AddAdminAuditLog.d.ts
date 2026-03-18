import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddAdminAuditLog1762354000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
