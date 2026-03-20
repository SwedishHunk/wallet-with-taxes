import { useApiData, triggerSync } from "../hooks/useApi";
import StatCard from "../components/StatCard";
import ActivityFeed from "../components/ActivityFeed";
import ErrorBanner from "../components/ErrorBanner";
import { fmtNum } from "../utils/formatNumber";
import { useLanguage } from "../../lib/LanguageContext";
import { useWallet } from "../context/WalletContext";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Users,
  Droplets,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { t } = useLanguage();
  const { isConnected, connecting, connect } = useWallet();
  const { data: summary, error: summaryError, refresh: refreshSummary } = useApiData(
    isConnected ? "/analytics/summary" : null,
  );
  const {
    data: activity,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useApiData(isConnected ? "/analytics/activity?limit=10" : null);
  const {
    data: liquidity,
    loading: liqLoading,
    error: liqError,
    refresh: refreshLiq,
  } = useApiData(isConnected ? "/shop/liquidity" : null);
  const { data: config, loading: configLoading, error: configError } = useApiData(
    isConnected ? "/shop/config" : null,
  );

  const [syncing, setSyncing] = useState(false);

  // Retry after 2 s to catch the race where sync was still writing when
  // the component first fetched (e.g. navigated here right after a trade).
  useEffect(() => {
    if (!isConnected) return undefined;
    const t = setTimeout(() => {
      refreshSummary();
      refreshActivity();
      refreshLiq();
    }, 2000);
    return () => clearTimeout(t);
  }, [isConnected, refreshSummary, refreshActivity, refreshLiq]);

  // Auto-refresh every 8 seconds so new trades appear quickly.
  useEffect(() => {
    if (!isConnected) return undefined;
    const interval = setInterval(() => {
      refreshSummary();
      refreshActivity();
      refreshLiq();
    }, 8000);
    return () => clearInterval(interval);
  }, [isConnected, refreshSummary, refreshActivity, refreshLiq]);

  // Refresh immediately when the tab becomes visible again.
  useEffect(() => {
    if (!isConnected) return undefined;
    function onVisible() {
      if (document.visibilityState === "visible") {
        refreshSummary();
        refreshActivity();
        refreshLiq();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isConnected, refreshSummary, refreshActivity, refreshLiq]);

  // Combine errors
  const apiError = isConnected
    ? summaryError || activityError || liqError || configError
    : null;

  async function handleSync() {
    if (!isConnected) return;
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
          disabled={syncing || !isConnected}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? t("player.dash.syncing") : t("player.dash.syncNow")}
        </button>
      </div>

      {!isConnected ? (
        <div
          className="card-glow max-w-3xl"
          style={{
            padding: "2rem",
            border: "1px solid rgba(0, 212, 255, 0.12)",
            background:
              "linear-gradient(180deg, rgba(10,15,30,0.92) 0%, rgba(10,15,30,0.78) 100%)",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: "rgba(0, 212, 255, 0.08)",
                border: "1px solid rgba(0, 212, 255, 0.18)",
              }}
            >
              <Wallet size={22} className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">
                {t("player.dash.walletRequiredTitle")}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {t("player.dash.walletRequiredBody")}
              </p>
              <div className="mt-5">
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Wallet size={16} />
                  {connecting
                    ? t("player.wallet.connecting")
                    : t("player.wallet.connect")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

          {/* Error Banner */}
          <ErrorBanner message={apiError} onRetry={handleRetry} />

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
        </>
      )}
    </div>
  );
}
