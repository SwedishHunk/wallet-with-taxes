import { useApiData, apiGet, apiPost, triggerSync } from "../hooks/useApi";
import { useWallet } from "../context/WalletContext";
import StatCard from "../components/StatCard";
import ActivityFeed from "../components/ActivityFeed";
import ErrorBanner from "../components/ErrorBanner";
import { fmtNum } from "../utils/formatNumber";
import { useLanguage } from "../../lib/LanguageContext";
import { useParams } from "react-router-dom";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Users,
  Droplets,
  RefreshCw,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

export default function Dashboard() {
  const { t } = useLanguage();
  const { gameId } = useParams();
  const { isConnected, address, signer } = useWallet();
  const { data: summary, error: summaryError, refresh: refreshSummary } = useApiData("/analytics/summary");
  const { data: activity, loading: activityLoading, error: activityError, refresh: refreshActivity } = useApiData("/analytics/activity?limit=10");
  const { data: liquidity, loading: liqLoading, error: liqError, refresh: refreshLiq } = useApiData("/shop/liquidity");
  const { data: config, loading: configLoading, error: configError } = useApiData("/shop/config");

  const { data: gameWallet, refresh: refreshGameWallet } = useApiData(
    isConnected && address && gameId
      ? `/platform/player/wallet?gameId=${encodeURIComponent(gameId)}&address=${encodeURIComponent(address)}`
      : null,
  );

  const [syncing, setSyncing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStatus, setTransferStatus] = useState(null);

  const sendPlayerAction = useCallback(
    async (endpoint, extraBody) => {
      if (!isConnected || !address || !signer || !gameId) return;
      const nonceData = await apiGet(
        `/player/nonce?walletAddress=${encodeURIComponent(address)}&purpose=player_action&gameId=${encodeURIComponent(gameId)}`,
      );
      const signature = await signer.signMessage(nonceData.message);
      return apiPost(endpoint, {
        gameId,
        walletAddress: address,
        nonce: nonceData.nonce,
        signature,
        ...extraBody,
      });
    },
    [isConnected, address, signer, gameId],
  );

  const handleWithdraw = useCallback(async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) return;
    setWithdrawStatus({ type: "loading", msg: "Sign in MetaMask…" });
    try {
      await sendPlayerAction("/platform/player/withdraw", { amount: amt });
      setWithdrawStatus({ type: "success", msg: "Withdrawal successful" });
      setWithdrawAmount("");
      refreshGameWallet();
    } catch (err) {
      setWithdrawStatus({ type: "error", msg: err?.message || "Withdrawal failed" });
    }
  }, [withdrawAmount, sendPlayerAction, refreshGameWallet]);

  const handleTransfer = useCallback(async () => {
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0 || !transferTo.trim()) return;
    setTransferStatus({ type: "loading", msg: "Sign in MetaMask…" });
    try {
      await sendPlayerAction("/platform/player/transfer", {
        toWalletAddress: transferTo.trim(),
        amount: amt,
      });
      setTransferStatus({ type: "success", msg: "Transfer successful" });
      setTransferAmount("");
      setTransferTo("");
      refreshGameWallet();
    } catch (err) {
      setTransferStatus({ type: "error", msg: err?.message || "Transfer failed" });
    }
  }, [transferAmount, transferTo, sendPlayerAction, refreshGameWallet]);

  // Retry after 2 s to catch the race where sync was still writing when
  // the component first fetched (e.g. navigated here right after a trade).
  useEffect(() => {
    const t = setTimeout(() => {
      refreshSummary();
      refreshActivity();
      refreshLiq();
    }, 2000);
    return () => clearTimeout(t);
  }, [refreshSummary, refreshActivity, refreshLiq]);

  // Auto-refresh every 8 seconds so new trades appear quickly.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSummary();
      refreshActivity();
      refreshLiq();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshSummary, refreshActivity, refreshLiq]);

  // Refresh immediately when the tab becomes visible again.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        refreshSummary();
        refreshActivity();
        refreshLiq();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshSummary, refreshActivity, refreshLiq]);

  // Combine errors
  const apiError = summaryError || activityError || liqError || configError;

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
      await Promise.all([refreshSummary(), refreshActivity(), refreshLiq()]);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }

  function handleRetry() {
    refreshSummary();
    refreshActivity();
    refreshLiq();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="glow-text-cyan">{t("player.dash.title")}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">{t("player.dash.subtitle")}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? t("player.dash.syncing") : t("player.dash.syncNow")}
        </button>
      </div>

      {/* Error Banner */}
      <ErrorBanner message={apiError} onRetry={handleRetry} />

      {/* In-Game Wallet — only shown when inside a game context */}
      {gameId && isConnected && (
        <div className="card mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-gray-400" />
            <p className="label">In-Game Wallet</p>
          </div>

          <div className="mb-4">
            <p className="text-2xl font-mono text-neon-cyan font-bold">
              {gameWallet ? Number(gameWallet.balance).toFixed(4) : "—"} tokens
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Your balance in this game</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Withdraw */}
            <div className="p-3 bg-dark-700/50 rounded-lg">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Withdraw</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-neon-cyan"
                  min="0"
                />
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || withdrawStatus?.type === "loading"}
                  className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
                >
                  <ArrowDownLeft size={14} />
                </button>
              </div>
              {withdrawStatus && (
                <p
                  className={`text-xs mt-1 ${
                    withdrawStatus.type === "success"
                      ? "text-neon-green"
                      : withdrawStatus.type === "error"
                        ? "text-neon-pink"
                        : "text-gray-400"
                  }`}
                >
                  {withdrawStatus.msg}
                </p>
              )}
            </div>

            {/* Transfer */}
            <div className="p-3 bg-dark-700/50 rounded-lg">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Transfer to player</p>
              <input
                type="text"
                placeholder="Recipient wallet address"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-neon-cyan mb-2"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-neon-cyan"
                  min="0"
                />
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={!transferAmount || !transferTo || transferStatus?.type === "loading"}
                  className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
                >
                  <ArrowUpRight size={14} />
                </button>
              </div>
              {transferStatus && (
                <p
                  className={`text-xs mt-1 ${
                    transferStatus.type === "success"
                      ? "text-neon-green"
                      : transferStatus.type === "error"
                        ? "text-neon-pink"
                        : "text-gray-400"
                  }`}
                >
                  {transferStatus.msg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t("player.dash.triSupply")}
          value={fmtNum(summary?.genTotalSupply) || "0"}
          sub={t("player.dash.circulating")}
          color="cyan"
          icon={Coins}
        />
        <StatCard
          label={t("player.dash.totalBuys")}
          value={fmtNum(summary?.totalBuys) ?? "—"}
          sub={`${fmtNum(summary?.totalGenMinted || 0)} ${t("player.dash.triMinted")}`}
          color="green"
          icon={TrendingUp}
        />
        <StatCard
          label={t("player.dash.totalSells")}
          value={fmtNum(summary?.totalSells) ?? "—"}
          sub={`${fmtNum(summary?.totalGenBurned || 0)} ${t("player.dash.triBurned")}`}
          color="pink"
          icon={TrendingDown}
        />
        <StatCard
          label={t("player.dash.uniqueUsers")}
          value={fmtNum(summary?.uniqueUsers) ?? "—"}
          sub={`${fmtNum(summary?.uniqueBuyers || 0)} ${t("player.dash.buyers")} · ${fmtNum(summary?.uniqueSellers || 0)} ${t("player.dash.sellers")}`}
          color="purple"
          icon={Users}
        />
      </div>

      {/* Liquidity + Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card-glow">
          <p className="label mb-3 flex items-center gap-2">
            <Droplets size={14} />
            {t("player.dash.liquidity")}
          </p>
          {liqLoading ? (
            <div className="h-16 bg-dark-700 rounded animate-pulse" />
          ) : liqError ? (
            <p className="text-neon-pink text-xs">{t("player.dash.liqError")}</p>
          ) : (
            <div className="space-y-2">
              {liquidity &&
                Object.entries(liquidity).map(([symbol, amount]) => (
                  <div
                    key={symbol}
                    className="flex items-center justify-between py-2 px-3 bg-dark-700/50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-300">{symbol}</span>
                    <span className="font-mono text-sm glow-text-cyan">{fmtNum(amount)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card-glow lg:col-span-2">
          <p className="label mb-3">{t("player.dash.config")}</p>
          {configLoading ? (
            <div className="h-16 bg-dark-700 rounded animate-pulse" />
          ) : configError ? (
            <p className="text-neon-pink text-xs">{t("player.dash.configError")}</p>
          ) : config ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-dark-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t("player.dash.status")}</p>
                <p className={`text-sm font-semibold mt-0.5 ${config.paused ? "text-neon-pink" : "text-neon-green"}`}>
                  {config.paused ? "PAUSED" : "ACTIVE"}
                </p>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t("player.dash.fee")}</p>
                <p className="text-sm font-mono text-gray-200 mt-0.5">{config.feePercent}%</p>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t("player.dash.buyRate")}</p>
                <p className="text-sm font-mono text-gray-200 mt-0.5">
                  1 ETH = {config.rates?.eth?.buyRate || "—"} TRI
                </p>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t("player.dash.maxEthIn")}</p>
                <p className="text-sm font-mono text-gray-200 mt-0.5">{config.maxEthIn} ETH</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed events={activity || []} loading={activityLoading} />
    </div>
  );
}