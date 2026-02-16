/**
 * Test helpers for e2e tests
 * Provides utilities for:
 * - Auth headers (JWT token)
 * - Response shape validation
 */

import request from "supertest";
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
export function validateGameWalletShape(data: any): TestGameWalletResponse {
  if (
    !data.id ||
    !data.balance ||
    data.totalDeposited === undefined ||
    data.totalWithdrawn === undefined
  ) {
    throw new Error(
      `Invalid wallet shape. Expected {id, balance, totalDeposited, totalWithdrawn}, got: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

/**
 * Validates ledger entry response shape
 * Throws if shape is invalid
 */
export function validateLedgerEntryShape(data: any): TestLedgerEntry {
  if (
    !data.id ||
    !data.type ||
    !data.amount ||
    !data.txGroupId ||
    !data.description
  ) {
    throw new Error(
      `Invalid ledger entry shape. Expected {id, type, amount, txGroupId, description}, got: ${JSON.stringify(data)}`,
    );
  }
  if (!["deposit", "withdraw", "transfer"].includes(data.type)) {
    throw new Error(`Invalid ledger type: ${data.type}`);
  }
  return data;
}

/**
 * Validates that response is an array of ledger entries
 */
export function validateLedgerArrayShape(data: any[]): TestLedgerEntry[] {
  if (!Array.isArray(data)) {
    throw new Error(`Expected array of ledger entries, got: ${typeof data}`);
  }
  return data.map(validateLedgerEntryShape);
}

/**
 * Helper to make authenticated request to game wallet endpoint
 */
export async function getGameWallet(
  app: any,
  gameId: string,
  token: string,
): Promise<Test> {
  return request(app)
    .get(`/platform/games/${gameId}/wallet`)
    .set(authHeader(token))
    .expect(200);
}

/**
 * Helper to make authenticated request to game wallet ledger endpoint
 */
export async function getGameWalletLedger(
  app: any,
  gameId: string,
  token: string,
) {
  return request(app)
    .get(`/platform/games/${gameId}/wallet/ledger`)
    .set(authHeader(token))
    .expect(200);
}
