import { useEffect, useState, useCallback } from "react";
import {
  getGameWallet,
  getGameWalletLedger,
  depositToWallet,
  withdrawFromWallet,
  transferBetweenPlayers,
} from "../../lib/platform";
import { getStudioMembers } from "../../lib/users";
import { useAuthState } from "../../lib/AuthContext";

interface LedgerEntry {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: string;
  txGroupId: string;
  counterpartyUserId?: string;
  description?: string;
  createdAt: string;
}

interface StudioMember {
  id: string;
  userId: string;
  email: string;
}

interface GameWallet {
  id: string;
  balance: string;
  totalDeposited: string;
  totalWithdrawn: string;
}

export default function WalletInfo() {
  const { authContext, activeGame } = useAuthState();

  // Wallet state
  const [wallet, setWallet] = useState<GameWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [members, setMembers] = useState<StudioMember[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDesc, setDepositDesc] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferToUser, setTransferToUser] = useState("");
  const [transferDesc, setTransferDesc] = useState("");

  // Submit states
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadWalletData = useCallback(async () => {
    if (
      !activeGame ||
      (authContext.state !== "StudioAuthenticated" &&
        authContext.state !== "Studio+MemberActive")
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [walletRes, ledgerRes] = await Promise.all([
        getGameWallet(activeGame.gameId),
        getGameWalletLedger(activeGame.gameId),
      ]);

      setWallet(walletRes.data);
      setLedger(ledgerRes.data || []);
    } catch (err) {
      console.error("Failed to load wallet data:", err);
      setError("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  }, [activeGame, authContext.state]);

  const loadMembers = useCallback(async () => {
    if (!authContext.studioSession?.studioId) {
      return;
    }

    try {
      const res = await getStudioMembers(authContext.studioSession.studioId);
      setMembers(res.data || []);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  }, [authContext.studioSession?.studioId]);

  useEffect(() => {
    loadWalletData();
    loadMembers();
  }, [loadWalletData, loadMembers]);

  const validateAmount = (amount: string): boolean => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) return;

    if (!validateAmount(depositAmount)) {
      setError("Deposit amount must be greater than 0");
      return;
    }

    setSubmitting("deposit");
    setError(null);
    setSuccessMsg(null);

    try {
      await depositToWallet(activeGame.gameId, depositAmount, depositDesc || undefined);
      setSuccessMsg("Deposit successful!");
      setDepositAmount("");
      setDepositDesc("");
      await loadWalletData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Deposit failed";
      setError(msg);
      console.error("Deposit error:", err);
    } finally {
      setSubmitting(null);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) return;

    if (!validateAmount(withdrawAmount)) {
      setError("Withdraw amount must be greater than 0");
      return;
    }

    setSubmitting("withdraw");
    setError(null);
    setSuccessMsg(null);

    try {
      await withdrawFromWallet(activeGame.gameId, withdrawAmount, withdrawDesc || undefined);
      setSuccessMsg("Withdrawal successful!");
      setWithdrawAmount("");
      setWithdrawDesc("");
      await loadWalletData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Withdrawal failed";
      setError(msg);
      console.error("Withdraw error:", err);
    } finally {
      setSubmitting(null);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) return;

    if (!validateAmount(transferAmount)) {
      setError("Transfer amount must be greater than 0");
      return;
    }

    if (!transferToUser) {
      setError("Select a recipient");
      return;
    }

    setSubmitting("transfer");
    setError(null);
    setSuccessMsg(null);

    try {
      await transferBetweenPlayers(
        activeGame.gameId,
        transferToUser,
        transferAmount,
        transferDesc || undefined,
      );
      setSuccessMsg("Transfer successful!");
      setTransferAmount("");
      setTransferToUser("");
      setTransferDesc("");
      await loadWalletData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Transfer failed";
      setError(msg);
      console.error("Transfer error:", err);
    } finally {
      setSubmitting(null);
    }
  };

  // Group ledger entries by txGroupId
  const groupedLedger = ledger.reduce(
    (acc, entry) => {
      if (!acc[entry.txGroupId]) {
        acc[entry.txGroupId] = [];
      }
      acc[entry.txGroupId].push(entry);
      return acc;
    },
    {} as Record<string, LedgerEntry[]>,
  );

  // Not authenticated
  if (
    authContext.state !== "StudioAuthenticated" &&
    authContext.state !== "Studio+MemberActive"
  ) {
    return <p>Not authenticated</p>;
  }

  // No active game selected
  if (!activeGame) {
    return <p>Välj ett spel först</p>;
  }

  return (
    <div className="space-y-6">
      {/* Wallet Summary */}
      <div className="border rounded-lg p-4 shadow">
        <h2 className="text-lg font-semibold mb-4">Wallet Summary</h2>
        {loading ? (
          <p className="text-gray-600">Loading wallet...</p>
        ) : wallet ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="text-xl font-semibold">{wallet.balance}</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-sm text-gray-600">Total Deposited</p>
              <p className="text-xl font-semibold">{wallet.totalDeposited}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <p className="text-sm text-gray-600">Total Withdrawn</p>
              <p className="text-xl font-semibold">{wallet.totalWithdrawn}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded">
          {successMsg}
        </div>
      )}

      {/* Forms */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deposit Form */}
        <div className="border rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Deposit</h3>
          <form onSubmit={handleDeposit} className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting === "deposit"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={depositDesc}
                onChange={(e) => setDepositDesc(e.target.value)}
                placeholder="e.g., Initial deposit"
                disabled={submitting === "deposit"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting === "deposit"}
              className="w-full bg-blue-600 text-white py-1 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting === "deposit" ? "Depositing..." : "Deposit"}
            </button>
          </form>
        </div>

        {/* Withdraw Form */}
        <div className="border rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Withdraw</h3>
          <form onSubmit={handleWithdraw} className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="text"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting === "withdraw"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={withdrawDesc}
                onChange={(e) => setWithdrawDesc(e.target.value)}
                placeholder="e.g., Game completion"
                disabled={submitting === "withdraw"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting === "withdraw"}
              className="w-full bg-orange-600 text-white py-1 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting === "withdraw" ? "Withdrawing..." : "Withdraw"}
            </button>
          </form>
        </div>

        {/* Transfer Form */}
        <div className="border rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Transfer</h3>
          <form onSubmit={handleTransfer} className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">Recipient</label>
              <select
                value={transferToUser}
                onChange={(e) => setTransferToUser(e.target.value)}
                disabled={submitting === "transfer"}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="">Select member...</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="text"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting === "transfer"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={transferDesc}
                onChange={(e) => setTransferDesc(e.target.value)}
                placeholder="e.g., Reward transfer"
                disabled={submitting === "transfer"}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting === "transfer"}
              className="w-full bg-purple-600 text-white py-1 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting === "transfer" ? "Transferring..." : "Transfer"}
            </button>
          </form>
        </div>
      </div>

      {/* Ledger List */}
      <div className="border rounded-lg p-4 shadow">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        {ledger.length === 0 ? (
          <p className="text-gray-600">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedLedger).map(([txGroupId, entries]) => (
              <div key={txGroupId} className="bg-gray-50 p-3 rounded border text-sm">
                <div className="text-xs text-gray-500 mb-2">
                  TX Group: {txGroupId.substring(0, 8)}...
                </div>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex justify-between items-start py-1 border-t first:border-t-0"
                  >
                    <div className="flex-1">
                      <div className="font-medium capitalize">{entry.type}</div>
                      <div className="text-gray-600">{entry.description || "-"}</div>
                      {entry.type === "transfer" && entry.counterpartyUserId && (
                        <div className="text-xs text-gray-500">
                          Party: {entry.counterpartyUserId.substring(0, 8)}...
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right font-semibold">{entry.amount}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
