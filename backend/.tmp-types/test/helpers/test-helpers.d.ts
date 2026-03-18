import type { INestApplication } from "@nestjs/common";
import type { Test } from "supertest";
export interface TestUser {
    id: string;
    email: string;
    studioId: string;
    role: "owner" | "member" | "admin";
}
export interface TestGameWalletResponse {
    id: string;
    balance: string;
    totalDeposited: string;
    totalWithdrawn: string;
}
export interface TestLedgerEntry {
    id: string;
    type: "deposit" | "withdraw" | "transfer";
    amount: string;
    txGroupId: string;
    counterpartyUserId?: string;
    intentId?: string | null;
    txHash?: string | null;
    description?: string;
    createdAt: string;
}
export declare function authHeader(token: string): {
    Authorization: string;
};
export declare function validateGameWalletShape(data: unknown): TestGameWalletResponse;
export declare function validateLedgerEntryShape(data: unknown): TestLedgerEntry;
export declare function validateLedgerArrayShape(data: unknown): TestLedgerEntry[];
export declare function getGameWallet(app: INestApplication, gameId: string, token: string): Promise<Test>;
export declare function getGameWalletLedger(app: INestApplication, gameId: string, token: string): Promise<import("superagent/lib/node/response")>;
