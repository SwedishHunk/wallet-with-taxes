/**
 * Business constants — single source of truth
 *
 * All magic numbers that represent business rules live here.
 * When a tax rate changes or a revenue split is renegotiated,
 * update this file instead of hunting through service code.
 */

// ─── Revenue Split (must sum to 1.0) ──────────────────────────
/** Developer share of protocol fees (60%) */
export const REVENUE_SPLIT_DEV = 0.6;

/** Triolith protocol share of protocol fees (30%) */
export const REVENUE_SPLIT_TRIOLITH = 0.3;

/** Staker/validator share of protocol fees (10%) */
export const REVENUE_SPLIT_STAKERS = 0.1;

/** SAFU cut — taken from Triolith's portion (5%) */
export const SAFU_CUT_FROM_TRIOLITH = 0.05;

// ─── Swedish Tax Rules ─────────────────────────────────────────
/**
 * Swedish tax law: capital losses on financial assets are 70% deductible.
 * Reference: Inkomstskattelagen 48 kap. 20-24 §§
 */
export const SWEDISH_LOSS_DEDUCTION_RATE = 0.7;

// ─── Platform Defaults ─────────────────────────────────────────
/** Default platform fee if no DB config is found (2.5%) */
export const DEFAULT_PLATFORM_FEE_PERCENT = 2.5;
