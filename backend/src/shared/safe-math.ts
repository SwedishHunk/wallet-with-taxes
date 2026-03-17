/**
 * Safe decimal arithmetic for financial balance operations.
 *
 * WHY THIS EXISTS:
 * JavaScript's floating-point (IEEE 754) has rounding errors:
 *   0.1 + 0.2 = 0.30000000000000004  (not 0.3)
 *
 * For wallet balances, these tiny errors accumulate over thousands
 * of transactions and cause real balance discrepancies.
 *
 * HOW IT WORKS:
 * We multiply everything by 1,000,000 (6 decimal places), do the
 * math with integers (which are exact), then convert back to a string.
 */

const PRECISION = 1_000_000; // 6 decimal places
const DECIMAL_PLACES = 6;

/**
 * Remove unnecessary trailing zeros from a decimal string.
 * "7.000000" → "7", "100.500000" → "100.5", "0.300000" → "0.3"
 */
function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  // Remove trailing zeros, then remove trailing dot if present
  return value.replace(/\.?0+$/, "");
}

/**
 * Safely add a number to a string-based balance.
 * Example: safeAdd("100.50", 0.1) → "100.6" (exact, no float errors)
 */
export function safeAdd(balance: string, amount: number): string {
  const balanceInt = Math.round(parseFloat(balance) * PRECISION);
  const amountInt = Math.round(amount * PRECISION);
  return trimTrailingZeros(
    ((balanceInt + amountInt) / PRECISION).toFixed(DECIMAL_PLACES),
  );
}

/**
 * Safely subtract a number from a string-based balance.
 * Example: safeSub("100.50", 0.1) → "100.4" (exact, no float errors)
 */
export function safeSub(balance: string, amount: number): string {
  const balanceInt = Math.round(parseFloat(balance) * PRECISION);
  const amountInt = Math.round(amount * PRECISION);
  return trimTrailingZeros(
    ((balanceInt - amountInt) / PRECISION).toFixed(DECIMAL_PLACES),
  );
}
