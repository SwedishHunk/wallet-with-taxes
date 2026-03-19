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
import { useLanguage } from "../../lib/LanguageContext";
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

// ─── Card config — ordered by usage hierarchy: Deposit > Transfer > Withdraw ──
const CARDS = [
  {
    id: "deposit",
    titleKey: "dash.deposit",
    accent: "#4ade80",
    glow: "rgba(74,222,128,0.22)",
    btnGrad: "linear-gradient(135deg, #16a34a 0%, #4ade80 100%)",
    // Primary — most common action, slightly elevated default state
    defaultBorderAlpha: "33",
    defaultGlow: "0 0 18px rgba(74,222,128,0.07)",
  },
  {
    id: "transfer",
    titleKey: "dash.transfer",
    accent: "#818cf8",
    glow: "rgba(129,140,248,0.20)",
    btnGrad: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
    // Secondary — used occasionally
    defaultBorderAlpha: "22",
    defaultGlow: "0 0 12px rgba(0,0,0,0.2)",
  },
  {
    id: "withdraw",
    titleKey: "dash.withdraw",
    accent: "#f87171",
    glow: "rgba(248,113,113,0.20)",
    btnGrad: "linear-gradient(135deg, #dc2626 0%, #f87171 100%)",
    // Tertiary — destructive, intentionally subdued
    defaultBorderAlpha: "16",
    defaultGlow: "0 0 8px rgba(0,0,0,0.15)",
  },
] as const;

type CardId = (typeof CARDS)[number]["id"];

export default function WalletInfo() {
  const { authContext, activeGame } = useAuthState();
  const { t } = useLanguage();

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
      setError(t("dash.errLoadWallet"));
    } finally {
      setLoading(false);
    }
  }, [activeGame, authContext.state, t]);

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
    if (!activeGame || !validateAmount(depositAmount)) { setError(t("dash.errAmountPositive")); return; }
    setSubmitting("deposit"); setError(null); setSuccessMsg(null);
    try {
      await depositToWallet(activeGame.gameId, depositAmount, depositDesc || undefined);
      setSuccessMsg(t("dash.successDeposit")); setDepositAmount(""); setDepositDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t("dash.errDepositFailed"));
    } finally { setSubmitting(null); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !validateAmount(withdrawAmount)) { setError(t("dash.errAmountPositive")); return; }
    setSubmitting("withdraw"); setError(null); setSuccessMsg(null);
    try {
      await withdrawFromWallet(activeGame.gameId, withdrawAmount, withdrawDesc || undefined);
      setSuccessMsg(t("dash.successWithdraw")); setWithdrawAmount(""); setWithdrawDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t("dash.errWithdrawFailed"));
    } finally { setSubmitting(null); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !validateAmount(transferAmount)) { setError(t("dash.errAmountPositive")); return; }
    if (!transferToUser) { setError(t("dash.errSelectRecipient")); return; }
    setSubmitting("transfer"); setError(null); setSuccessMsg(null);
    try {
      await transferBetweenPlayers(activeGame.gameId, transferToUser, transferAmount, transferDesc || undefined);
      setSuccessMsg(t("dash.successTransfer")); setTransferAmount(""); setTransferToUser(""); setTransferDesc("");
      await loadWalletData(); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t("dash.errTransferFailed"));
    } finally { setSubmitting(null); }
  };

  const groupedLedger = ledger.reduce((acc, entry) => {
    if (!acc[entry.txGroupId]) acc[entry.txGroupId] = [];
    acc[entry.txGroupId].push(entry);
    return acc;
  }, {} as Record<string, LedgerEntry[]>);

  if (authContext.state !== "StudioAuthenticated" && authContext.state !== "Studio+MemberActive") {
    return <p className="text-amber-300/60">{t("dash.notAuth")}</p>;
  }
  if (!activeGame) {
    return <p className="text-amber-300/60">{t("dash.selectGameFirst")}</p>;
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
          {t("dash.walletSummary")}
        </h2>
        {loading ? (
          <p style={{ color: "#78716c" }}>{t("dash.loadingWallet")}</p>
        ) : wallet ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: t("dash.balance"),        value: wallet.balance,        accent: "#e2e8f0" },
              { label: t("dash.totalDeposited"), value: wallet.totalDeposited, accent: "#4ade80" },
              { label: t("dash.totalWithdrawn"), value: wallet.totalWithdrawn, accent: "#f87171" },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${accent}22`,
                borderRadius: 10,
                padding: "12px 14px",
              }}>
                <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
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
              border: `1px solid ${hoveredCard === card.id ? card.accent + "66" : card.accent + card.defaultBorderAlpha}`,
              borderRadius: 14,
              padding: card.id === "deposit" ? "22px 22px 20px" : 20,
              boxShadow: hoveredCard === card.id
                ? `0 0 40px ${card.glow}, 0 8px 32px rgba(0,0,0,0.5)`
                : card.defaultGlow,
              transition: "border-color 0.2s, box-shadow 0.2s",
              position: "relative",
              zIndex: 1,
            }}
          >
            <h3 style={{ color: card.accent, fontFamily: "Orbitron,Inter,sans-serif", fontSize: card.id === "deposit" ? 15 : 13, marginBottom: 14, letterSpacing: "0.05em", flexShrink: 0, opacity: card.id === "withdraw" ? 0.85 : 1 }}>
              {t(card.titleKey)}
            </h3>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {card.id === "deposit" && (
                <form onSubmit={handleDeposit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>{t("dash.amount")}</label>
                    <input type="text" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" disabled={submitting === "deposit"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("dash.descriptionOptional")}</label>
                    <input type="text" value={depositDesc} onChange={e => setDepositDesc(e.target.value)} placeholder="e.g., Initial deposit" disabled={submitting === "deposit"} className={inputCls} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <button type="submit" disabled={submitting === "deposit"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "deposit" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "deposit" ? t("dash.depositing") : t("dash.deposit")}
                  </button>
                </form>
              )}

              {card.id === "withdraw" && (
                <form onSubmit={handleWithdraw} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>{t("dash.amount")}</label>
                    <input type="text" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" disabled={submitting === "withdraw"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("dash.descriptionOptional")}</label>
                    <input type="text" value={withdrawDesc} onChange={e => setWithdrawDesc(e.target.value)} placeholder="e.g., Game completion" disabled={submitting === "withdraw"} className={inputCls} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <button type="submit" disabled={submitting === "withdraw"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "withdraw" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "withdraw" ? t("dash.withdrawing") : t("dash.withdraw")}
                  </button>
                </form>
              )}

              {card.id === "transfer" && (
                <form onSubmit={handleTransfer} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className={labelCls}>{t("dash.recipient")}</label>
                    <select value={transferToUser} onChange={e => setTransferToUser(e.target.value)} disabled={submitting === "transfer"} className={inputCls}>
                      <option value="">{t("dash.selectMember")}</option>
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>{m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("dash.amount")}</label>
                    <input type="text" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" disabled={submitting === "transfer"} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("dash.descriptionOptional")}</label>
                    <input type="text" value={transferDesc} onChange={e => setTransferDesc(e.target.value)} placeholder="e.g., Reward transfer" disabled={submitting === "transfer"} className={inputCls} />
                  </div>
                  <button type="submit" disabled={submitting === "transfer"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${card.accent}70`, background: `${card.accent}15`, color: card.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em", opacity: submitting === "transfer" ? 0.5 : 1, backdropFilter: "blur(8px)" }}>
                    {submitting === "transfer" ? t("dash.transferring") : t("dash.transfer")}
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
          {t("dash.txHistory")}
        </h2>
        {ledger.length === 0 ? (
          <p style={{ color: "#78716c", fontSize: 14 }}>{t("dash.noTransactions")}</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedLedger).map(([txGroupId, entries]) => (
              <div key={txGroupId} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(129,140,248,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
                <div style={{ fontSize: 12, color: "#78716c", marginBottom: 8, fontFamily: "monospace" }}>
                  {t("dash.txGroup")} {txGroupId.substring(0, 8)}…
                </div>
                {entries.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderTop: "1px solid rgba(129,140,248,0.08)" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: entry.type === "deposit" ? "#4ade80" : entry.type === "withdraw" ? "#f87171" : "#818cf8" }}>
                        {entry.type === "deposit" ? t("dash.deposit") : entry.type === "withdraw" ? t("dash.withdraw") : t("dash.transfer")}
                      </div>
                      <div style={{ color: "#a8a29e", fontSize: 12 }}>{entry.description || "—"}</div>
                      {entry.type === "transfer" && entry.counterpartyUserId && (
                        <div style={{ color: "#78716c", fontSize: 12, fontFamily: "monospace" }}>{t("dash.party")} {entry.counterpartyUserId.substring(0, 8)}…</div>
                      )}
                      <div style={{ color: "#57534e", fontSize: 12 }}>{new Date(entry.createdAt).toLocaleString()}</div>
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
