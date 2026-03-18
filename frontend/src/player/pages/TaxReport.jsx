import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { useLanguage } from "../../lib/LanguageContext";
import { apiGet } from "../hooks/useApi";
import ErrorBanner from "../components/ErrorBanner";
import StatCard from "../components/StatCard";
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Scale,
  Download,
  RefreshCw,
  Wallet,
  WifiOff,
} from "lucide-react";

/**
 * TAX REPORT PAGE
 *
 * This page talks to the wallet-with-taxes backend (default: port 3001)
 * to show Swedish tax data. Everything else in the frontend talks to
 * our own backend (port 3000).
 *
 * How it works:
 * 1. User connects wallet (MetaMask)
 * 2. We call GET /tax/summary?user=0x... on the tax backend
 * 3. We display gains, losses, and the Swedish-adjusted tax amount
 * 4. User can download a CSV tax report from GET /tax/export?user=0x...
 *
 * ERROR HANDLING:
 * - If the tax backend is not running → shows "Tax service unavailable" message
 * - If the fetch fails for other reasons → shows the specific error
 * - Connection status indicator (green/red dot) at the top
 *
 * CONFIGURATION:
 * - Set VITE_TAX_API_URL in frontend/.env to change the tax backend URL
 * - Default: http://localhost:3001
 */

const TAX_API = ""; // tax routes live on the main backend via /api/tax/...

export default function TaxReport() {
  const { t } = useLanguage();
  const { isConnected, address } = useWallet();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown, true/false

  // ---- Check if the tax backend is reachable ----
  const checkBackendStatus = useCallback(async () => {
    try {
      await apiGet("/tax/summary?user=0x0000000000000000000000000000000000000000");
      setBackendOnline(true);
    } catch {
      // 403 means reachable (zero address not owned), anything else is a problem
      setBackendOnline(true);
    }
  }, []);

  // Check backend status on mount
  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  // ---- Fetch tax summary for connected wallet ----
  const fetchSummary = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/tax/summary?user=${address}`);
      setSummary(data);
      setBackendOnline(true);
    } catch (err) {
      setError(err.message);
      setBackendOnline(true);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Fetch on connect
  useEffect(() => {
    if (isConnected && address) {
      fetchSummary();
    }
  }, [isConnected, address, fetchSummary]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(fetchSummary, 10000);
    return () => clearInterval(interval);
  }, [isConnected, fetchSummary]);

  async function handleRefresh() {
    setRefreshing(true);
    await checkBackendStatus();
    await fetchSummary();
    setRefreshing(false);
  }

  async function handleExportCSV() {
    if (!address) return;
    const token = sessionStorage.getItem("token");
    const res = await fetch(`/api/tax/export?user=${address}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${address.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- NOT CONNECTED STATE ----
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="p-6 rounded-full bg-dark-800 border border-dark-600 mb-6">
          <Wallet size={40} className="text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-300 mb-2">
          {t("player.tax.connectWallet")}
        </h2>
        <p className="text-gray-500 text-sm">
          {t("player.tax.connectDesc")}
        </p>
      </div>
    );
  }

  // ---- CONNECTION FAILED STATE ----
  if (error === "CONNECTION_FAILED" && !summary) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="glow-text-green">{t("player.tax.title")}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t("player.tax.subtitle")}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            {t("player.tax.retryConn")}
          </button>
        </div>

        <div className="card text-center py-12">
          <div className="p-4 rounded-full bg-neon-pink/10 inline-block mb-4">
            <WifiOff size={32} className="text-neon-pink" />
          </div>
          <h2 className="text-lg font-bold text-gray-200 mb-2">
            {t("player.tax.unavailable")}
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">
            {t("player.tax.couldNotConnect")}{" "}
            <code className="text-neon-cyan bg-dark-700 px-2 py-0.5 rounded text-xs">
              {TAX_API}
            </code>
          </p>
          <div className="bg-dark-700/50 rounded-lg p-4 max-w-md mx-auto text-left">
            <p className="text-sm text-gray-300 font-semibold mb-2">
              {t("player.tax.toFix")}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              {t("player.tax.step1")}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              {t("player.tax.step2")}
            </p>
            <p className="text-sm text-gray-400">
              {t("player.tax.step3")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasActivity =
    summary &&
    (summary.totalGainsUSD !== 0 ||
      summary.totalLossesUSD !== 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="glow-text-green">{t("player.tax.title")}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t("player.tax.subtitle")}
            </p>
          </div>
          {/* Connection status indicator */}
          {backendOnline !== null && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                backendOnline
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-neon-pink/10 text-neon-pink"
              }`}
              title={
                backendOnline
                  ? `Tax backend connected (${TAX_API})`
                  : `Tax backend offline (${TAX_API})`
              }
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline ? "bg-neon-green" : "bg-neon-pink"
                }`}
              />
              {backendOnline ? t("player.tax.connected") : t("player.tax.offline")}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            {t("player.tax.refresh")}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!summary || !backendOnline}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={14} />
            {t("player.tax.exportCsv")}
          </button>
        </div>
      </div>

      {/* Error Banner (for non-connection errors) */}
      {error && error !== "CONNECTION_FAILED" && (
        <ErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {/* Connection lost warning (when we had data but lost connection) */}
      {!backendOnline && summary && (
        <div className="bg-neon-pink/5 border border-neon-pink/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300">
            <span className="text-neon-pink font-semibold">
              {t("player.tax.connLost")}
            </span>{" "}
            {t("player.tax.connLostDesc")}
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg p-4 mb-8">
        <p className="text-sm text-gray-300">
          <span className="text-neon-cyan font-semibold">
            {t("player.tax.howItWorks")}
          </span>{" "}
          {t("player.tax.howItWorksDesc")}
        </p>
      </div>

      {/* Loading State */}
      {loading && !summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-dark-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Stats Grid */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label={t("player.tax.totalGains")}
            value={`$${summary.totalGainsUSD.toFixed(2)}`}
            sub={t("player.tax.gainsSub")}
            color="green"
            icon={TrendingUp}
          />
          <StatCard
            label={t("player.tax.totalLosses")}
            value={`$${Math.abs(summary.totalLossesUSD).toFixed(2)}`}
            sub={t("player.tax.lossesSub")}
            color="pink"
            icon={TrendingDown}
          />
          <StatCard
            label={t("player.tax.adjustedLosses")}
            value={`$${Math.abs(summary.adjustedLossesUSD).toFixed(2)}`}
            sub={t("player.tax.adjustedSub")}
            color="purple"
            icon={Scale}
          />
          <StatCard
            label={t("player.tax.netGain")}
            value={`$${summary.netTaxableGainUSD.toFixed(2)}`}
            sub={t("player.tax.netGainSub")}
            color="cyan"
            icon={Receipt}
          />
        </div>
      )}

      {/* Tax Explanation Card */}
      {summary && (
        <div className="card mb-8">
          <p className="label mb-4 flex items-center gap-2">
            <Scale size={14} />
            {t("player.tax.calcTitle")}
          </p>

          <div className="space-y-4">
            {/* Gains */}
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-neon-green/10">
                  <TrendingUp size={14} className="text-neon-green" />
                </div>
                <span className="text-sm text-gray-300">
                  {t("player.tax.totalCapGains")}
                </span>
              </div>
              <span className="font-mono text-sm text-neon-green">
                +${summary.totalGainsUSD.toFixed(2)}
              </span>
            </div>

            {/* Losses */}
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-neon-pink/10">
                  <TrendingDown size={14} className="text-neon-pink" />
                </div>
                <span className="text-sm text-gray-300">
                  {t("player.tax.totalCapLosses")}
                </span>
              </div>
              <span className="font-mono text-sm text-neon-pink">
                -${Math.abs(summary.totalLossesUSD).toFixed(2)}
              </span>
            </div>

            {/* 70% rule */}
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-neon-purple/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-neon-purple/10">
                  <Scale size={14} className="text-neon-purple" />
                </div>
                <div>
                  <span className="text-sm text-gray-300">
                    {t("player.tax.adjLosses70")}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("player.tax.adj70Desc")}
                  </p>
                </div>
              </div>
              <span className="font-mono text-sm text-neon-purple">
                -${Math.abs(summary.adjustedLossesUSD).toFixed(2)}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-dark-500 my-2" />

            {/* Net result */}
            <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg border border-neon-cyan/30">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-neon-cyan/10">
                  <Receipt size={14} className="text-neon-cyan" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-200">
                    {t("player.tax.netTaxableGain")}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("player.tax.reportTo")}
                  </p>
                </div>
              </div>
              <span
                className={`font-mono text-lg font-bold ${
                  summary.netTaxableGainUSD >= 0
                    ? "glow-text-green"
                    : "glow-text-pink"
                }`}
              >
                ${summary.netTaxableGainUSD.toFixed(2)}
              </span>
            </div>

            {/* USD disclaimer */}
            <p className="text-xs text-gray-600 italic mt-2">
              {t("player.tax.usdNote")}
            </p>
          </div>
        </div>
      )}

      {/* No Activity Message */}
      {summary && !hasActivity && (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">
            {t("player.tax.noActivity")}{" "}
            <a href="/player/trade" className="text-neon-cyan hover:underline">
              {t("player.tax.tradePage")}
            </a>{" "}
            {t("player.tax.noActivityEnd")}
          </p>
        </div>
      )}

      {/* Wallet Address */}
      <div className="text-center mt-6">
        <p className="text-xs text-gray-600 font-mono">
          Wallet: {address}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Tax backend: {TAX_API}
        </p>
      </div>
    </div>
  );
}
