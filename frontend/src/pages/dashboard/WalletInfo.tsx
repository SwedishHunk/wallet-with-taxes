import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  getGameWallet,
  getGameWalletLedger,
  depositToWallet,
  withdrawFromWallet,
  transferBetweenPlayers,
} from "../../lib/platform";
import { getStudioMembers } from "../../lib/users";
import { useAuthState } from "../../lib/AuthContext";
import { fmtNum } from "../../player/utils/formatNumber";

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

// ─── Shared dark input style ──────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-lg text-sm border border-white/10 " +
  "bg-black/40 text-slate-100 placeholder-slate-600 " +
  "focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition-colors";

const labelCls = "block text-xs font-medium mb-1 text-slate-400 tracking-wide uppercase";

// ─── Domino card config ───────────────────────────────────────────────────────
const CARDS = [
  {
    id: "deposit",
    title: "Deposit",
    accent: "#4ade80",   // neon green — money in
    glow: "rgba(74,222,128,0.20)",
    btnGrad: "linear-gradient(135deg, #16a34a 0%, #4ade80 100%)",
  },
  {
    id: "withdraw",
    title: "Withdraw",
    accent: "#f87171",   // neon red — money out
    glow: "rgba(248,113,113,0.20)",
    btnGrad: "linear-gradient(135deg, #dc2626 0%, #f87171 100%)",
  },
  {
    id: "transfer",
    title: "Transfer",
    accent: "#818cf8",   // soft indigo — neutral movement
    glow: "rgba(129,140,248,0.20)",
    btnGrad: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
  },
] as const;

type CardId = (typeof CARDS)[number]["id"];

export default function WalletInfo() {
  const { authContext, activeGame } = useAuthState();

  const [wallet, setWallet] = useState<GameWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [hoveredCard, setHoveredCard] = useState<CardId | null>(null);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositDesc, setDepositDesc] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferToUser, setTransferToUser] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadWalletData = useCallback(async () => {
    if (
      !activeGame ||
      (authContext.state !== "StudioAuthenticated" &&
        authContext.state !== "Studio+MemberActive")
    ) return;
    try {
      setLoading(true);
      setError(null);
      const [walletRes, ledgerRes] = await Promise.all([
        getGameWallet(activeGame.gameId),
        getGameWalletLedger(activeGame.gameId),
      ]);
      setWallet(walletRes.data);
      setLedger(ledgerRes.data || []);
    } catch {
      setError("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  }, [activeGame, authContext.state]);

  const loadMembers = useCallback(async () => {
    if (!authContext.studioSession?.studioId) return;
    try {
      const res = await getStudioMembers(authContext.studioSession.studioId);
      setMembers(res.data || []);
    } catch { /* silent */ }
  }, [authContext.studioSession?.studioId]);

  useEffect(() => {
    loadWalletData();
    loadMembers();
  }, [loadWalletData, loadMembers]);

  const validateAmount = (a: string) => !isNaN(parseFloat(a)) && parseFloat(a) > 0;

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !validateAmount(depositAmount)) { setError("Amount must be > 0"); return; }
    setSubmitting("deposit"); setError(null); setSuccessMsg(null);
    try {
      await depositToWallet(activeGame.gameId, depositAmount, depositDesc || undefined);
      setSuccessMsg("Deposit successful!"); setDepositAmount(""); setDepositDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Deposit failed");
    } finally { setSubmitting(null); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !validateAmount(withdrawAmount)) { setError("Amount must be > 0"); return; }
    setSubmitting("withdraw"); setError(null); setSuccessMsg(null);
    try {
      await withdrawFromWallet(activeGame.gameId, withdrawAmount, withdrawDesc || undefined);
      setSuccessMsg("Withdrawal successful!"); setWithdrawAmount(""); setWithdrawDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Withdrawal failed");
    } finally { setSubmitting(null); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !validateAmount(transferAmount)) { setError("Amount must be > 0"); return; }
    if (!transferToUser) { setError("Select a recipient"); return; }
    setSubmitting("transfer"); setError(null); setSuccessMsg(null);
    try {
      await transferBetweenPlayers(activeGame.gameId, transferToUser, transferAmount, transferDesc || undefined);
      setSuccessMsg("Transfer successful!"); setTransferAmount(""); setTransferToUser(""); setTransferDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Transfer failed");
    } finally { setSubmitting(null); }
  };

  const groupedLedger = ledger.reduce((acc, entry) => {
    if (!acc[entry.txGroupId]) acc[entry.txGroupId] = [];
    acc[entry.txGroupId].push(entry);
    return acc;
  }, {} as Record<string, LedgerEntry[]>);

  if (authContext.state !== "StudioAuthenticated" && authContext.state !== "Studio+MemberActive") {
    return <p className="text-amber-300/60">Not authenticated</p>;
  }
  if (!activeGame) {
    return <p className="text-amber-300/60">Select a game first</p>;
  }

  // ─── Hover expand helper ──────────────────────────────────────────────────
  function getCardMotion(id: CardId) {
    const isHovered = hoveredCard === id;
    return {
      scale:      isHovered ? 1.04 : 1,
      transition: { type: "spring" as const, stiffness: 280, damping: 24 },
    };
  }

  return (
    <div className="space-y-6">

      {/* ── Wallet Summary ─────────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(10,8,20,0.7)",
          border: "1px solid rgba(129,140,248,0.18)",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 0 30px rgba(129,140,248,0.06)",
        }}
      >
        <h2 style={{ color: "#a78bfa", fontFamily: "Orbitron,Inter,sans-serif", fontSize: 16, marginBottom: 16, letterSpacing: "0.05em" }}>
          Wallet Summary
        </h2>
        {loading ? (
          <p style={{ color: "#78716c" }}>Loading wallet…</p>
        ) : wallet ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Balance",         value: wallet.balance,        accent: "#e2e8f0" },
              { label: "Total Deposited", value: wallet.totalDeposited, accent: "#4ade80" },
              { label: "Total Withdrawn", value: wallet.totalWithdrawn, accent: "#f87171" },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${accent}22`,
                borderRadius: 10,
                padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: accent, fontFamily: "monospace" }}>{fmtNum(value)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.3)", borderRadius: 10, padding: "12px 16px", color: "#fb7185", fontSize: 14 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 10, padding: "12px 16px", color: "#34d399", fontSize: 14 }}>
          {successMsg}
        </div>
      )}

      {/* ── Domino Cards ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {CARDS.map((card) => (
          <motion.div
            key={card.id}
            animate={getCardMotion(card.id)}
            onHoverStart={() => setHoveredCard(card.id)}
            onHoverEnd={() => setHoveredCard(null)}
            style={{
              background: "rgba(6,5,15,0.85)",
              border: `1px solid ${hoveredCard === card.id ? card.accent + "55" : card.accent + "22"}`,
              borderRadius: 14,
              padding: 20,
              boxShadow: hoveredCard === card.id
                ? `0 0 40px ${card.glow}, 0 8px 32px rgba(0,0,0,0.5)`
                : `0 0 15px rgba(0,0,0,0.3)`,
              transition: "border-color 0.2s, box-shadow 0.2s",
              position: "relative",
              zIndex: 1,
            }}
          >
            <h3 style={{ color: card.accent, fontFamily: "Orbitron,Inter,sans-serif", fontSize: 14, marginBottom: 14, letterSpacing: "0.05em", flexShrink: 0 }}>
              {card.title}
            </h3>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {card.id === "deposit" && (
                <form onSubmit={handleDeposit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="text" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" disabled={submitting === "deposit"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description (optional)</label>
                    <input type="text" value={depositDesc} onChange={e => setDepositDesc(e.target.value)} placeholder="e.g., Initial deposit" disabled={submitting === "deposit"} className={inputCls} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <button type="submit" disabled={submitting === "deposit"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "deposit" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "deposit" ? "Depositing…" : "Deposit"}
                  </button>
                </form>
              )}

              {card.id === "withdraw" && (
                <form onSubmit={handleWithdraw} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="text" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" disabled={submitting === "withdraw"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description (optional)</label>
                    <input type="text" value={withdrawDesc} onChange={e => setWithdrawDesc(e.target.value)} placeholder="e.g., Game completion" disabled={submitting === "withdraw"} className={inputCls} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <button type="submit" disabled={submitting === "withdraw"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "withdraw" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "withdraw" ? "Withdrawing…" : "Withdraw"}
                  </button>
                </form>
              )}

              {card.id === "transfer" && (
                <form onSubmit={handleTransfer} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>Recipient</label>
                    <select value={transferToUser} onChange={e => setTransferToUser(e.target.value)} disabled={submitting === "transfer"} className={inputCls}>
                      <option value="">Select member…</option>
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>{m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="text" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" disabled={submitting === "transfer"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description (optional)</label>
                    <input type="text" value={transferDesc} onChange={e => setTransferDesc(e.target.value)} placeholder="e.g., Reward transfer" disabled={submitting === "transfer"} className={inputCls} />
                  </div>
                  <button type="submit" disabled={submitting === "transfer"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "transfer" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "transfer" ? "Transferring…" : "Transfer"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Transaction History ────────────────────────────────────────── */}
      <div style={{
        background: "rgba(10,8,20,0.7)",
        border: "1px solid rgba(129,140,248,0.15)",
        borderRadius: 16,
        padding: 20,
      }}>
        <h2 style={{ color: "#a78bfa", fontFamily: "Orbitron,Inter,sans-serif", fontSize: 16, marginBottom: 16, letterSpacing: "0.05em" }}>
          Transaction History
        </h2>
        {ledger.length === 0 ? (
          <p style={{ color: "#78716c", fontSize: 14 }}>No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedLedger).map(([txGroupId, entries]) => (
              <div key={txGroupId} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(129,140,248,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
                <div style={{ fontSize: 11, color: "#78716c", marginBottom: 8, fontFamily: "monospace" }}>
                  TX Group: {txGroupId.substring(0, 8)}…
                </div>
                {entries.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderTop: "1px solid rgba(129,140,248,0.08)" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: entry.type === "deposit" ? "#4ade80" : entry.type === "withdraw" ? "#f87171" : "#818cf8", textTransform: "capitalize" }}>{entry.type}</div>
                      <div style={{ color: "#a8a29e", fontSize: 12 }}>{entry.description || "—"}</div>
                      {entry.type === "transfer" && entry.counterpartyUserId && (
                        <div style={{ color: "#78716c", fontSize: 11, fontFamily: "monospace" }}>Party: {entry.counterpartyUserId.substring(0, 8)}…</div>
                      )}
                      <div style={{ color: "#57534e", fontSize: 11 }}>{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: entry.type === "deposit" ? "#4ade80" : entry.type === "withdraw" ? "#f87171" : "#818cf8", fontFamily: "monospace", fontSize: 14 }}>{fmtNum(entry.amount)}</div>
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
