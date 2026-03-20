export function formatErrorMessage(message: unknown, fallback = "Something went wrong.") {
  const raw =
    typeof message === "string" && message.trim()
      ? message.trim()
      : fallback;

  const normalized = raw.toLowerCase();

  if (
    normalized.includes("could not decode result data") ||
    normalized.includes("bad_data")
  ) {
    return "Could not read contract data. Check that the wallet is connected to the right network and that the contract is available.";
  }

  if (
    normalized.includes("internal server error") ||
    normalized.includes("failed to fetch")
  ) {
    return "Could not load data right now. Check that the backend and local blockchain are running, then try again.";
  }

  if (normalized.includes("network error")) {
    return "Could not reach the server. Check your local services and try again.";
  }

  return raw;
}
