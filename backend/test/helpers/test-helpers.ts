/**
 * Test helpers for e2e tests
 * Provides utilities for:
 * - Auth headers (JWT token)
 * - Response shape validation
 */

import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Test } from "supertest";
import type { Server } from "http";

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
  description: string;
  createdAt: string;
}

/**
 * Creates Authorization header with JWT token
 * @param token JWT token from login
 * @returns Object with Authorization header
 */
export function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Validates game wallet response shape
 * Throws if shape is invalid
 */
export function validateGameWalletShape(data: unknown): TestGameWalletResponse {
  const record = data as Record<string, unknown>;
  if (
    !record.id ||
    !record.balance ||
    record.totalDeposited === undefined ||
    record.totalWithdrawn === undefined
  ) {
    throw new Error(
      `Invalid wallet shape. Expected {id, balance, totalDeposited, totalWithdrawn}, got: ${JSON.stringify(data)}`,
    );
  }
  return data as TestGameWalletResponse;
}

/**
 * Validates ledger entry response shape
 * Throws if shape is invalid
 */
export function validateLedgerEntryShape(data: unknown): TestLedgerEntry {
  const record = data as Record<string, unknown>;
  if (
    !record.id ||
    !record.type ||
    !record.amount ||
    !record.txGroupId ||
    !record.description
  ) {
    throw new Error(
      `Invalid ledger entry shape. Expected {id, type, amount, txGroupId, description}, got: ${JSON.stringify(data)}`,
    );
  }
  const typeVal = record.type;
  const typeStr =
    typeof typeVal === "string" ? typeVal : JSON.stringify(typeVal);
  if (!["deposit", "withdraw", "transfer"].includes(typeStr)) {
    throw new Error(`Invalid ledger type: ${typeStr}`);
  }
  return data as TestLedgerEntry;
}

/**
 * Validates that response is an array of ledger entries
 */
export function validateLedgerArrayShape(data: unknown): TestLedgerEntry[] {
  if (!Array.isArray(data)) {
    throw new Error(`Expected array of ledger entries, got: ${typeof data}`);
  }
  return data.map(validateLedgerEntryShape);
}

/**
 * Helper to make authenticated request to game wallet endpoint
 */
export async function getGameWallet(
  app: INestApplication,
  gameId: string,
  token: string,
): Promise<Test> {
  return request(app.getHttpServer() as Server)
    .get(`/platform/games/${gameId}/wallet`)
    .set(authHeader(token))
    .expect(200);
}

/**
 * Helper to make authenticated request to game wallet ledger endpoint
 */
export async function getGameWalletLedger(
  app: INestApplication,
  gameId: string,
  token: string,
) {
  return request(app.getHttpServer() as Server)
    .get(`/platform/games/${gameId}/wallet/ledger`)
    .set(authHeader(token))
    .expect(200);
}
