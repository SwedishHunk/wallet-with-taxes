type TxError = {
  code?: string | number;
  shortMessage?: string;
  reason?: string;
  message?: string;
  data?: {
    message?: string;
    originalError?: {
      message?: string;
    };
  };
  info?: {
    error?: {
      message?: string;
    };
  };
  error?: {
    reason?: string;
    message?: string;
    data?: {
      message?: string;
      originalError?: {
        message?: string;
      };
    };
  };
};

function pickRawMessage(error: TxError) {
  return (
    error.reason ||
    error.error?.reason ||
    error.data?.originalError?.message ||
    error.error?.data?.originalError?.message ||
    error.data?.message ||
    error.error?.data?.message ||
    error.info?.error?.message ||
    error.shortMessage ||
    error.error?.message ||
    error.message ||
    "Transaction failed"
  );
}

export function formatTxError(error: TxError, fallback = "Transaction failed") {
  if (error.code === 4001 || error.code === "ACTION_REJECTED") {
    return "Transaction was cancelled in the wallet.";
  }

  const raw = pickRawMessage(error);
  const normalized = raw.toLowerCase();

  if (normalized.includes("insufficient funds")) {
    return "Wallet does not have enough ETH to cover this transaction.";
  }

  if (
    normalized.includes("internal json-rpc error") &&
    normalized.includes("insufficient funds")
  ) {
    return "Wallet does not have enough ETH to cover this transaction.";
  }

  if (normalized.includes("over maxethin")) {
    return "Amount exceeds the current maximum ETH buy limit.";
  }

  if (normalized.includes("over maxgenin")) {
    return "Amount exceeds the current maximum TRI sell limit.";
  }

  if (normalized.includes("no liquidity")) {
    return "TokenShop does not have enough liquidity for this trade.";
  }

  if (normalized.includes("paused")) {
    return "TokenShop is currently paused.";
  }

  if (normalized.includes("slippage")) {
    return "Trade was rejected because the quote moved too much.";
  }

  if (normalized.includes("asset not supported") || normalized.includes("eth not supported")) {
    return "Selected asset is not supported by TokenShop.";
  }

  if (normalized.includes("transfer amount exceeds balance")) {
    return "Wallet balance is too low for this transaction.";
  }

  if (
    normalized.includes("execution reverted: transfer amount exceeds balance") ||
    normalized.includes("erc20: transfer amount exceeds balance")
  ) {
    return "Wallet balance is too low for this transaction.";
  }

  if (normalized.includes("user rejected") || normalized.includes("user denied")) {
    return "Transaction was cancelled in the wallet.";
  }

  if (
    normalized.includes("internal json-rpc error") ||
    normalized.includes("could not coalesce error")
  ) {
    return "Wallet or RPC rejected the transaction. Check balance, limits and permissions, then try again.";
  }

  if (normalized.includes("missing revert data") || normalized.includes("estimategas")) {
    return "Transaction simulation failed. Check amount, balance, limits and wallet permissions.";
  }

  return raw || fallback;
}
