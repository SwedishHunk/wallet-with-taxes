/**
 * Format a number with commas (e.g. 1234567 → "1,234,567")
 * Handles strings, numbers, null, undefined gracefully
 */
export function fmtNum(value, decimals = 2) {
  if (value == null || value === "" || value === "—") return value || "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}
