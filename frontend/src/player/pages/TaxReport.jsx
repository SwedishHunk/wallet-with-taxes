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

const TAX_API = ""; // tax routes live on the main backend via /api/tax/...

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => CURRENT_YEAR - i);

function fmt(value, currency) {
  if (value == null) return "—";
  const abs = Math.abs(value).toFixed(2);
  return currency === "SEK" ? `${abs} kr` : `$${abs}`;
}

export default function TaxReport() {
  const { t } = useLanguage();
  const { isConnected, address } = useWallet();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [selectedYear, setSelectedYear] = useState("");

  const checkBackendStatus = useCallback(async () => {
    try {
      await fetch("/health");
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  const fetchSummary = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      const yearParam = selectedYear ? `&year=${selectedYear}` : "";
      const data = await apiGet(`/tax/summary?user=${address}${yearParam}`);
      setSummary(data);
      setBackendOnline(true);
    } catch (err) {
      setError(err.message);
      setBackendOnline(true);
    } finally {
      setLoading(false);
    }
  }, [address, selectedYear]);

  useEffect(() => {
    if (isConnected && address) {
      fetchSummary();
    }
  }, [isConnected, address, fetchSummary]);

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
    const yearParam = selectedYear ? `&year=${selectedYear}` : "";
    const res = await fetch(`/tax/export?user=${address}${yearParam}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${address.slice(0, 8)}${selectedYear ? `-${selectedYear}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasSEK =
    summary &&
    (summary.totalGainsSEK != null || summary.totalLossesSEK != null);

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

  if (error === "CONNECTION_FAILED" && !summary) {
    return (
      <div>
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
    (summary.totalGainsUSD !== 0 || summary.totalLossesUSD !== 0);

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
        <div className="flex gap-2 items-center">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-dark-700 border border-dark-500 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-neon-cyan"
          >
            <option value="">All years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
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

      {/* Error Banner */}
      {error && error !== "CONNECTION_FAILED" && (
        <ErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {/* Connection lost warning */}
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

      {/* Legal disclaimer */}
      <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-4 mb-4">
        <p className="text-xs text-yellow-300 font-semibold mb-1">
          Informational only — not verified tax advice
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          This data is generated for reference purposes only. It does not constitute
          a completed K4 declaration or verified Swedish tax advice. Prices marked
          as "missing" cannot be used for filing. Verify all figures with a qualified
          Swedish tax advisor (skatterådgivare) before submitting to Skatteverket.
        </p>
      </div>

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

      {/* Stats Grid — USD */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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

      {/* SEK Stats Grid — only shown when SEK data is available */}
      {summary && hasSEK && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Gains (SEK)"
            value={fmt(summary.totalGainsSEK, "SEK")}
            sub="Swedish kronor"
            color="green"
            icon={TrendingUp}
          />
          <StatCard
            label="Losses (SEK)"
            value={fmt(summary.totalLossesSEK, "SEK")}
            sub="Swedish kronor"
            color="pink"
            icon={TrendingDown}
          />
          <StatCard
            label="Adj. Losses (SEK)"
            value={fmt(summary.adjustedLossesSEK, "SEK")}
            sub="70% deductible"
            color="purple"
            icon={Scale}
          />
          <StatCard
            label="Net Taxable (SEK)"
            value={fmt(summary.netTaxableGainSEK, "SEK")}
            sub="Report to Skatteverket"
            color="cyan"
            icon={Receipt}
          />
        </div>
      )}

      {/* SEK unavailable notice */}
      {summary && !hasSEK && (
        <div className="bg-dark-700/40 border border-dark-500 rounded-lg p-3 mb-8 text-xs text-gray-500 italic">
          SEK values are unavailable — price oracle data is missing for one or more events. USD values are shown above.
        </div>
      )}

      {/* Tax Explanation Card */}
      {summary && (
        <div className="card mb-8">
          <p className="label mb-4 flex items-center gap-2">
            <Scale size={14} />
            {t("player.tax.calcTitle")}
            {summary.year && (
              <span className="ml-2 text-xs text-neon-cyan font-normal">
                {summary.year}
              </span>
            )}
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
              <div className="text-right">
                <span className="font-mono text-sm text-neon-green block">
                  +${summary.totalGainsUSD.toFixed(2)}
                </span>
                {hasSEK && summary.totalGainsSEK != null && (
                  <span className="font-mono text-xs text-neon-green/60 block">
                    +{summary.totalGainsSEK.toFixed(2)} kr
                  </span>
                )}
              </div>
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
              <div className="text-right">
                <span className="font-mono text-sm text-neon-pink block">
                  -${Math.abs(summary.totalLossesUSD).toFixed(2)}
                </span>
                {hasSEK && summary.totalLossesSEK != null && (
                  <span className="font-mono text-xs text-neon-pink/60 block">
                    -{Math.abs(summary.totalLossesSEK).toFixed(2)} kr
                  </span>
                )}
              </div>
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
              <div className="text-right">
                <span className="font-mono text-sm text-neon-purple block">
                  -${Math.abs(summary.adjustedLossesUSD).toFixed(2)}
                </span>
                {hasSEK && summary.adjustedLossesSEK != null && (
                  <span className="font-mono text-xs text-neon-purple/60 block">
                    -{Math.abs(summary.adjustedLossesSEK).toFixed(2)} kr
                  </span>
                )}
              </div>
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
              <div className="text-right">
                <span
                  className={`font-mono text-lg font-bold block ${
                    summary.netTaxableGainUSD >= 0
                      ? "glow-text-green"
                      : "glow-text-pink"
                  }`}
                >
                  ${summary.netTaxableGainUSD.toFixed(2)}
                </span>
                {hasSEK && summary.netTaxableGainSEK != null && (
                  <span
                    className={`font-mono text-sm block ${
                      summary.netTaxableGainSEK >= 0
                        ? "text-neon-green/70"
                        : "text-neon-pink/70"
                    }`}
                  >
                    {summary.netTaxableGainSEK.toFixed(2)} kr
                  </span>
                )}
              </div>
            </div>

            {/* Note */}
            {!hasSEK && (
              <p className="text-xs text-gray-600 italic mt-2">
                {t("player.tax.usdNote")}
              </p>
            )}
            {hasSEK && (
              <p className="text-xs text-gray-600 italic mt-2">
                SEK values calculated using Riksbanken/ECB exchange rates at each transaction date.
                Swedish tax law (IL 44 kap) requires SEK denomination — use the SEK figures for K4 filing.
              </p>
            )}
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
          Tax backend: {TAX_API || "(main backend)"}
        </p>
      </div>
    </div>
  );
}
