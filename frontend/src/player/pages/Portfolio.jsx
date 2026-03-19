import { useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useApiData, apiGet, apiPost, triggerSync } from "../hooks/useApi";
import { useLanguage } from "../../lib/LanguageContext";
import StatCard from "../components/StatCard";
import ErrorBanner from "../components/ErrorBanner";
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Landmark,
  Layers,
  Activity,
  ChartNoAxesCombined,
  Gem,
} from "lucide-react";
import { ethers } from "ethers";
import { useState, useEffect } from "react";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

function formatAmount(raw, decimals = 18) {
  try {
    return Number(ethers.formatUnits(raw, decimals)).toFixed(4);
  } catch {
    return raw;
  }
}

function formatDisplayNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return value >= 1000
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value.toFixed(4);
}

function formatCurrency(value, currency) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortenTxHash(txHash) {
  if (!txHash) {
    return "—";
  }

  return `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
}

function calculateEventFee(event, feeBps) {
  const feeFactor = 1 - feeBps / 10000;
  if (!Number.isFinite(feeFactor) || feeFactor <= 0 || feeFactor >= 1) {
    return null;
  }

  const assetDecimals = event.assetSymbol === "ETH" ? 18 : 6;

  if (event.type === "BUY") {
    const netTriOut = Number(formatAmount(event.amountOut, 18));
    if (!Number.isFinite(netTriOut)) {
      return null;
    }

    const grossTriOut = netTriOut / feeFactor;
    return {
      feeAmount: grossTriOut - netTriOut,
      feeSymbol: "TRI",
      netAmount: netTriOut,
      netSymbol: "TRI",
    };
  }

  const netAssetOut = Number(formatAmount(event.amountOut, assetDecimals));
  if (!Number.isFinite(netAssetOut)) {
    return null;
  }

  const grossAssetOut = netAssetOut / feeFactor;
  return {
    feeAmount: grossAssetOut - netAssetOut,
    feeSymbol: event.assetSymbol,
    netAmount: netAssetOut,
    netSymbol: event.assetSymbol,
  };
}

export default function Portfolio() {
  const { t } = useLanguage();
  const { gameId } = useParams();
  const { isConnected, address, provider, signer } = useWallet();
  const [syncing, setSyncing] = useState(false);
  const [ethBalance, setEthBalance] = useState(null);
  const [compatibleBalances, setCompatibleBalances] = useState([]);

  // In-game wallet state (game context only)
  const [gameWallet, setGameWallet] = useState(null);
  const [gameWalletLoading, setGameWalletLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [sendNftId, setSendNftId] = useState(null);
  const [sendNftTo, setSendNftTo] = useState("");
  const [sendNftStatus, setSendNftStatus] = useState({});

  const { data: balance, loading: balLoading, error: balError, refresh: refreshBal } = useApiData(
    isConnected ? `/user/${address}/balance` : null
  );
  const { data: history, loading: histLoading, error: histError, refresh: refreshHist } = useApiData(
    isConnected ? `/user/${address}/history` : null
  );
  const {
    data: supportedAssets,
    error: assetsError,
    refresh: refreshAssets,
  } = useApiData(isConnected ? "/shop/supported-assets" : null);
  const {
    data: config,
    error: configError,
    refresh: refreshConfig,
  } = useApiData(isConnected ? "/shop/config" : null);
  const {
    data: nfts,
    loading: nftsLoading,
    refresh: refreshNfts,
  } = useApiData(isConnected && address ? `/platform/player/nfts?address=${address}` : null);

  const apiError = balError || histError || assetsError || configError;

  // Fetch in-game wallet balance when in game context
  useEffect(() => {
    if (!gameId || !address || !isConnected) {
      setGameWallet(null);
      return;
    }
    setGameWalletLoading(true);
    apiGet(`/platform/player/wallet?gameId=${gameId}&address=${address}`)
      .then(setGameWallet)
      .catch(() => setGameWallet(null))
      .finally(() => setGameWalletLoading(false));
  }, [gameId, address, isConnected]);

  // Auto-refresh every 15 seconds so new trades show up
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      refreshBal();
      refreshHist();
      refreshAssets();
      refreshConfig();
      refreshNfts();
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, refreshBal, refreshHist, refreshAssets, refreshConfig, refreshNfts]);

  useEffect(() => {
    if (!isConnected || !address || !provider) {
      setEthBalance(null);
      return;
    }

    let active = true;

    provider
      .getBalance(address)
      .then((rawBalance) => {
        if (!active) return;
        setEthBalance(Number(ethers.formatEther(rawBalance)));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load ETH balance:", error);
        setEthBalance(null);
      });

    return () => {
      active = false;
    };
  }, [isConnected, address, provider, syncing]);

  useEffect(() => {
    if (!isConnected || !address || !provider || !supportedAssets?.length) {
      setCompatibleBalances([]);
      return;
    }

    let active = true;

    (async () => {
      try {
        const balances = await Promise.all(
          supportedAssets
            .filter((asset) => asset.address !== ETH_ADDRESS)
            .map(async (asset) => {
              if (asset.symbol === "TRI") {
                return {
                  symbol: asset.symbol,
                  address: asset.address,
                  balance: balance?.genBalance ? Number(balance.genBalance) : 0,
                };
              }

              const erc20 = new ethers.Contract(
                asset.address,
                ERC20_BALANCE_ABI,
                provider
              );
              const rawBalance = await erc20.balanceOf(address);
              return {
                symbol: asset.symbol,
                address: asset.address,
                balance: Number(ethers.formatUnits(rawBalance, asset.decimals)),
              };
            })
        );

        if (!active) return;
        setCompatibleBalances(
          balances
            .filter((asset) => asset.symbol !== "TRI")
            .sort((a, b) => b.balance - a.balance)
        );
      } catch (error) {
        if (!active) return;
        console.error("Failed to load compatible balances:", error);
        setCompatibleBalances([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [isConnected, address, provider, supportedAssets, balance]);

  async function thisPlayerSignedRequest(purpose, walletAddress) {
    if (!signer) throw new Error("Wallet signer not ready");
    const noncePayload = await apiGet(
      `/player/nonce?walletAddress=${encodeURIComponent(walletAddress)}&purpose=${encodeURIComponent(purpose)}&gameId=${encodeURIComponent(gameId ?? "")}`
    );
    const signature = await signer.signMessage(noncePayload.message);
    return { nonce: noncePayload.nonce, signature };
  }

  async function refreshGameWallet() {
    if (!gameId || !address) return;
    const updated = await apiGet(`/platform/player/wallet?gameId=${gameId}&address=${address}`);
    setGameWallet(updated);
  }

  async function handleWithdraw() {
    if (!gameId || !address || !withdrawAmount) return;
    setWithdrawStatus("pending");
    try {
      const auth = await thisPlayerSignedRequest("player_action", address);
      await apiPost("/platform/player/withdraw", {
        gameId, walletAddress: address,
        nonce: auth.nonce, signature: auth.signature,
        amount: Number(withdrawAmount),
      });
      setWithdrawAmount("");
      setWithdrawStatus("success");
      await refreshGameWallet();
    } catch (err) {
      setWithdrawStatus("error: " + err.message);
    }
  }

  async function handleTransfer() {
    if (!gameId || !address || !transferTo || !transferAmount) return;
    setTransferStatus("pending");
    try {
      const auth = await thisPlayerSignedRequest("player_action", address);
      await apiPost("/platform/player/transfer", {
        gameId, walletAddress: address,
        nonce: auth.nonce, signature: auth.signature,
        toWalletAddress: transferTo,
        amount: Number(transferAmount),
      });
      setTransferTo("");
      setTransferAmount("");
      setTransferStatus("success");
      await refreshGameWallet();
    } catch (err) {
      setTransferStatus("error: " + err.message);
    }
  }

  async function handleSendNFT(nftId) {
    if (!gameId || !address || !sendNftTo) return;
    setSendNftStatus((s) => ({ ...s, [nftId]: "pending" }));
    try {
      const auth = await thisPlayerSignedRequest("player_action", address);
      await apiPost("/platform/player/nft-transfer", {
        gameId, walletAddress: address,
        nonce: auth.nonce, signature: auth.signature,
        toWalletAddress: sendNftTo,
        nftInstanceId: nftId,
      });
      setSendNftId(null);
      setSendNftTo("");
      setSendNftStatus((s) => ({ ...s, [nftId]: "success" }));
      refreshNfts();
    } catch (err) {
      setSendNftStatus((s) => ({ ...s, [nftId]: "error: " + err.message }));
    }
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      await triggerSync();
      await Promise.all([refreshBal(), refreshHist(), refreshAssets(), refreshConfig(), refreshNfts()]);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="p-6 rounded-full bg-dark-800 border border-dark-600 mb-6">
          <Wallet size={40} className="text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-300 mb-2">{t("player.portfolio.connectWallet")}</h2>
        <p className="text-gray-500 text-sm">{t("player.portfolio.connectDesc")}</p>
      </div>
    );
  }

  const positions = history?.positions || [];
  const events = history?.events || [];
  const feeBps = Number(config?.feeBps || 0);
  const totalBuys = positions.reduce((sum, position) => sum + position.buys, 0);
  const totalSells = positions.reduce((sum, position) => sum + position.sells, 0);
  const triBalance = balance?.genBalance ? Number(balance.genBalance) : 0;
  const trackedTriPosition = positions.reduce(
    (sum, position) => sum + Number(position.netGen || 0),
    0
  );
  const currentTriPriceEth = getCurrentTriPriceEth(config);
  const ethUsd = Number(config?.valuation?.ethUsd);
  const usdSek = Number(config?.valuation?.usdSek);
  const currentTriPriceUsd =
    currentTriPriceEth !== null && Number.isFinite(ethUsd) && ethUsd > 0
      ? currentTriPriceEth * ethUsd
      : null;
  const currentTriPriceSek =
    currentTriPriceUsd !== null && Number.isFinite(usdSek) && usdSek > 0
      ? currentTriPriceUsd * usdSek
      : null;
  const walletMarkedValueEth =
    currentTriPriceEth !== null ? triBalance * currentTriPriceEth : null;
  const estimatedCurrentValueEth =
    currentTriPriceEth !== null ? trackedTriPosition * currentTriPriceEth : null;
  const estimatedCurrentValueUsd =
    estimatedCurrentValueEth !== null && Number.isFinite(ethUsd) && ethUsd > 0
      ? estimatedCurrentValueEth * ethUsd
      : null;
  const estimatedCurrentValueSek =
    estimatedCurrentValueUsd !== null && Number.isFinite(usdSek) && usdSek > 0
      ? estimatedCurrentValueUsd * usdSek
      : null;
  const ethPosition = positions.find((position) => position.symbol === "ETH");
  const averageEntryPriceEth = ethPosition ? getAverageBuyPriceValue(ethPosition) : null;
  const averageEntryTriPerEth =
    averageEntryPriceEth !== null && averageEntryPriceEth > 0
      ? 1 / averageEntryPriceEth
      : null;
  const currentTriPerEth =
    currentTriPriceEth !== null && currentTriPriceEth > 0 ? 1 / currentTriPriceEth : null;
  const estimatedCostBasisEth =
    averageEntryPriceEth !== null ? trackedTriPosition * averageEntryPriceEth : null;
  const estimatedCostBasisUsd =
    estimatedCostBasisEth !== null && Number.isFinite(ethUsd) && ethUsd > 0
      ? estimatedCostBasisEth * ethUsd
      : null;
  const unrealizedPnlEth =
    estimatedCurrentValueEth !== null && estimatedCostBasisEth !== null
      ? estimatedCurrentValueEth - estimatedCostBasisEth
      : null;
  const unrealizedPnlUsd =
    estimatedCurrentValueUsd !== null && estimatedCostBasisUsd !== null
      ? estimatedCurrentValueUsd - estimatedCostBasisUsd
      : null;
  const pnlStatus = getPnlStatus(unrealizedPnlEth);
  const usesOnlyEthHistory = positions.every((position) => position.symbol === "ETH");
  const hasFiatValuation = Number.isFinite(ethUsd) && ethUsd > 0;
  const hasSekValuation = hasFiatValuation && Number.isFinite(usdSek) && usdSek > 0;
  const valuationSource = config?.valuation?.source || "unconfigured";
  const rateShiftWarning =
    averageEntryTriPerEth !== null &&
    currentTriPerEth !== null &&
    currentTriPerEth / averageEntryTriPerEth > 5
      ? `Rate shift: ${formatDisplayNumber(averageEntryTriPerEth)} TRI/ETH historically vs ${formatDisplayNumber(
          currentTriPerEth
        )} TRI/ETH now.`
      : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="glow-text-purple">{t("player.portfolio.title")}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1 font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {t("player.portfolio.refresh")}
        </button>
      </div>

      {/* Error Banner */}
      <ErrorBanner message={apiError} onRetry={handleRefresh} />

      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          {t("player.portfolio.holdings")}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {t("player.portfolio.holdingsDesc")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t("player.portfolio.ethBalance")}
          value={formatDisplayNumber(ethBalance)}
          sub={t("player.portfolio.ethBalanceSub")}
          color="purple"
          icon={Landmark}
        />
        <StatCard
          label={t("player.portfolio.triBalance")}
          value={balance?.genBalance || "0"}
          sub={t("player.portfolio.triBalanceSub")}
          color="cyan"
          icon={Coins}
        />
        <StatCard
          label={t("player.portfolio.trackedPos")}
          value={formatDisplayNumber(trackedTriPosition)}
          sub={t("player.portfolio.trackedPosSub")}
          color="green"
          icon={Activity}
        />
        <StatCard
          label={t("player.portfolio.buySell")}
          value={`${totalBuys} / ${totalSells}`}
          sub={t("player.portfolio.buySellSub")}
          color="pink"
          icon={ArrowUpRight}
        />
      </div>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          {t("player.portfolio.perf")}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          ETH-based valuation for the tracked TokenShop position, with optional USD/SEK snapshots from backend config.
        </p>
        <p className="text-[11px] text-gray-500 mt-2">
          {hasFiatValuation
            ? `Valuation source: ${formatValuationSource(valuationSource)}${
                hasSekValuation
                  ? ` • ETH/USD ${formatDisplayNumber(ethUsd)} • USD/SEK ${formatDisplayNumber(
                      usdSek
                    )}`
                  : ` • ETH/USD ${formatDisplayNumber(ethUsd)}`
              }`
            : "Valuation source: ETH-only estimate from current TokenShop rate"}
        </p>
        {rateShiftWarning && (
          <p className="text-[11px] text-neon-pink mt-2">{rateShiftWarning}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t("player.portfolio.currentTri")}
          value={
            currentTriPriceEth !== null
              ? `${formatDisplayNumber(currentTriPriceEth)} ETH`
              : "—"
          }
          sub="Based on current TokenShop ETH sell rate"
          meta={
            `${
              currentTriPerEth !== null
                ? `${formatDisplayNumber(currentTriPerEth)} TRI/ETH`
                : "TRI/ETH unavailable"
            }${
              hasFiatValuation
                ? ` • ${formatCurrency(currentTriPriceUsd, "USD")}${
                  hasSekValuation ? ` • ${formatCurrency(currentTriPriceSek, "SEK")}` : ""
                }`
                : ""
            }`
          }
          color="purple"
          icon={Activity}
        />
        <StatCard
          label={t("player.portfolio.avgEntry")}
          value={
            averageEntryPriceEth !== null
              ? `${formatDisplayNumber(averageEntryPriceEth)} ETH`
              : "—"
          }
          sub="Average ETH paid per TRI"
          meta={
            `${formatDisplayNumber(averageEntryTriPerEth)} TRI/ETH${
              usesOnlyEthHistory
                ? " • Based on your full TRI trade history"
                : " • Based on ETH-funded buys only"
            }`
          }
          color="cyan"
          icon={ChartNoAxesCombined}
        />
        <StatCard
          label={t("player.portfolio.estValue")}
          value={
            estimatedCurrentValueEth !== null
              ? `${formatDisplayNumber(estimatedCurrentValueEth)} ETH`
              : "—"
          }
          sub="Tracked TokenShop TRI marked to shop rate"
          meta={
            hasFiatValuation
              ? `${formatCurrency(estimatedCurrentValueUsd, "USD")}${
                  hasSekValuation ? ` • ${formatCurrency(estimatedCurrentValueSek, "SEK")}` : ""
                }`
              : "Fiat estimate unavailable"
          }
          color="green"
          icon={Coins}
        />
        <StatCard
          label={t("player.portfolio.pnl")}
          value={
            unrealizedPnlEth !== null
              ? `${unrealizedPnlEth >= 0 ? "+" : ""}${formatDisplayNumber(
                  unrealizedPnlEth
                )} ETH`
              : "—"
          }
          sub={t(pnlStatus)}
          meta={
            hasFiatValuation
              ? `${formatCurrency(unrealizedPnlUsd, "USD")} vs ETH cost basis`
              : "Estimate against ETH cost basis"
          }
          color={unrealizedPnlEth !== null && unrealizedPnlEth < 0 ? "pink" : "green"}
          icon={Landmark}
        />
      </div>

      <div className="card mb-8">
        <p className="label mb-1">{t("player.portfolio.walletVsTracked")}</p>
        <p className="text-xs text-gray-500 mb-4">
          Wallet balance can include TRI from minting, transfers, or sources outside TokenShop. Performance metrics above only use tracked TokenShop activity.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{t("player.portfolio.walletTri")}</p>
            <p className="text-lg font-mono text-gray-100 mt-1">
              {formatDisplayNumber(triBalance)} TRI
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {walletMarkedValueEth !== null
                ? `${formatDisplayNumber(walletMarkedValueEth)} ETH at current shop rate`
                : "Current ETH mark unavailable"}
            </p>
          </div>
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
              {t("player.portfolio.trackedTri")}
            </p>
            <p className="text-lg font-mono text-gray-100 mt-1">
              {formatDisplayNumber(trackedTriPosition)} TRI
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Used for value and PnL above to avoid mixing in unrelated wallet TRI.
            </p>
          </div>
        </div>
      </div>

      {/* In-Game Wallet (only shown in game context) */}
      {gameId && (
        <div className="card mb-8" style={{ border: "1px solid rgba(0, 212, 255, 0.15)" }}>
          <p className="label mb-5 text-center">{t("player.portfolio.inGameWallet")}</p>
          {gameWalletLoading ? (
            <div className="h-20 bg-dark-700 rounded animate-pulse" />
          ) : (
            <div className="space-y-4">
              {/* Balance */}
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(0, 212, 255, 0.04)",
                  border: "1px solid rgba(0, 212, 255, 0.12)",
                }}
              >
                <p className="label mb-2">{t("player.portfolio.gameBalance")}</p>
                <p className="text-3xl font-mono font-bold" style={{ color: "#00d4ff" }}>
                  {gameWallet?.balance ?? "0"}
                  <span className="text-sm font-normal text-gray-400 ml-2">{t("player.portfolio.inGameTokens")}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Withdraw */}
                <div
                  className="p-4 rounded-xl flex flex-col items-center"
                  style={{
                    background: "rgba(255, 51, 102, 0.04)",
                    border: "1px solid rgba(255, 51, 102, 0.15)",
                    minHeight: 180,
                  }}
                >
                  <p className="label mb-4 text-center" style={{ color: "#ff3366" }}>{t("player.portfolio.withdraw")}</p>
                  <div className="w-full space-y-2">
                    <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0" className="input-field py-2 text-sm w-full" />
                    <button onClick={handleWithdraw} disabled={withdrawStatus === "pending" || !withdrawAmount} className="btn-danger w-full py-2">
                      {withdrawStatus === "pending" ? "…" : t("player.portfolio.withdraw")}
                    </button>
                  </div>
                  {withdrawStatus && withdrawStatus !== "pending" && (
                    <p className={`text-xs mt-2 text-center ${withdrawStatus === "success" ? "text-neon-green" : "text-neon-pink"}`}>
                      {withdrawStatus === "success" ? t("player.portfolio.withdrawSuccess") : withdrawStatus}
                    </p>
                  )}
                </div>

                {/* Send tokens */}
                <div
                  className="p-4 rounded-xl flex flex-col items-center"
                  style={{
                    background: "rgba(0, 255, 128, 0.04)",
                    border: "1px solid rgba(0, 255, 128, 0.15)",
                    minHeight: 180,
                  }}
                >
                  <p className="label mb-4 text-center" style={{ color: "#00ff80" }}>{t("player.portfolio.sendTokens")}</p>
                  <div className="w-full space-y-2">
                    <input type="text" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder={t("player.portfolio.recipientPlaceholder")} className="input-field py-2 text-sm w-full" />
                    <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0" className="input-field py-2 text-sm w-full" />
                    <button onClick={handleTransfer} disabled={transferStatus === "pending" || !transferTo || !transferAmount} className="btn-success w-full py-2">
                      {transferStatus === "pending" ? "…" : t("player.portfolio.send")}
                    </button>
                  </div>
                  {transferStatus && transferStatus !== "pending" && (
                    <p className={`text-xs mt-2 text-center ${transferStatus === "success" ? "text-neon-green" : "text-neon-pink"}`}>
                      {transferStatus === "success" ? t("player.portfolio.sendSuccess") : transferStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(compatibleBalances.length > 0 || supportedAssets?.length > 0) && (
        <div className="card mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-gray-400" />
            <p className="label">{t("player.portfolio.compatibleAssets")}</p>
          </div>
          {compatibleBalances.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t("player.portfolio.noErc20")}
            </p>
          ) : (
            <div className="space-y-3">
              {compatibleBalances.map((asset) => (
                <div
                  key={asset.address}
                  className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg"
                >
                  <div>
                    <span className="text-sm font-semibold text-gray-200">
                      {asset.symbol}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {t("player.portfolio.compatibleLabel")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-gray-100">
                      {formatDisplayNumber(asset.balance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NFT Collectibles */}
      {(nftsLoading || (nfts && nfts.length > 0)) && (
        <div className="card mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Gem size={16} className="text-gray-400" />
            <p className="label">My Collectibles</p>
          </div>
          {nftsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-dark-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {nfts.map((nft) => {
                const tierColors = {
                  1: "text-gray-400",
                  2: "text-neon-green",
                  3: "text-neon-cyan",
                  4: "text-neon-pink",
                };
                const tierLabels = { 1: "Common", 2: "Rare", 3: "Epic", 4: "Legendary" };
                const tier = nft.template?.tier ?? 1;
                const conditionColor =
                  nft.condition >= 75
                    ? "text-neon-green"
                    : nft.condition >= 40
                    ? "text-yellow-400"
                    : "text-neon-pink";
                return (
                  <div
                    key={nft.id}
                    className="p-3 bg-dark-700/50 rounded-lg border border-dark-600"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-100 leading-tight">
                        {nft.name}
                      </p>
                      {nft.equipped && (
                        <span className="text-[10px] bg-neon-cyan/10 text-neon-cyan px-1.5 py-0.5 rounded ml-1 shrink-0">
                          Equipped
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-mono mb-1 ${tierColors[tier] ?? "text-gray-400"}`}>
                      {tierLabels[tier] ?? `Tier ${tier}`} · {nft.template?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nft.template?.game?.name && (
                        <span className="mr-2">🎮 {nft.template.game.name}</span>
                      )}
                    </p>
                    <div className="flex gap-3 mt-2 text-[11px] text-gray-500">
                      <span>Lvl {nft.level}</span>
                      <span className={conditionColor}>Cond {nft.condition}%</span>
                      {nft.power > 0 && <span>PWR {nft.power}</span>}
                    </div>

                    {/* Send NFT — only in game context */}
                    {gameId && (
                      <div className="mt-3">
                        {sendNftId === nft.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={sendNftTo}
                              onChange={(e) => setSendNftTo(e.target.value)}
                              placeholder={t("player.portfolio.recipientPlaceholder")}
                              className="input-field py-1.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSendNFT(nft.id)}
                                disabled={sendNftStatus[nft.id] === "pending" || !sendNftTo}
                                className="btn-secondary text-xs px-3 py-1.5 flex-1"
                              >
                                {sendNftStatus[nft.id] === "pending" ? "..." : t("player.portfolio.confirmSend")}
                              </button>
                              <button
                                onClick={() => {
                                  setSendNftId(null);
                                  setSendNftTo("");
                                  setSendNftStatus((s) => {
                                    const n = { ...s };
                                    delete n[nft.id];
                                    return n;
                                  });
                                }}
                                className="text-xs text-gray-500 hover:text-gray-300 px-2"
                              >
                                {t("player.portfolio.cancel")}
                              </button>
                            </div>
                            {sendNftStatus[nft.id] && sendNftStatus[nft.id] !== "pending" && (
                              <p className={`text-xs ${sendNftStatus[nft.id] === "success" ? "text-neon-green" : "text-neon-pink"}`}>
                                {sendNftStatus[nft.id] === "success" ? t("player.portfolio.nftSent") : sendNftStatus[nft.id]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setSendNftId(nft.id)}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                              border: "1px solid rgba(0, 212, 255, 0.2)",
                              color: "#9ca3af",
                              background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.5)";
                              e.currentTarget.style.color = "#00d4ff";
                              e.currentTarget.style.boxShadow = "0 0 10px rgba(0, 212, 255, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.2)";
                              e.currentTarget.style.color = "#9ca3af";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <ArrowUpRight size={11} />
                            {t("player.portfolio.sendNFT")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trading Breakdown */}
      {positions.length > 0 && (
        <div className="card mb-8">
          <p className="label mb-1">{t("player.portfolio.tradingBreakdown")}</p>
          <p className="text-xs text-gray-500 mb-4">
            Shows how your TRI position was built or reduced through each payment asset.
          </p>
          <div className="space-y-3">
            {positions.map((p) => (
              <div
                key={p.asset}
                className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg"
              >
                <div>
                  <span className="text-sm font-semibold text-gray-200">{p.symbol}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.buys} {t("player.portfolio.buysLabel")} · {p.sells} {t("player.portfolio.sellsLabel")}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${
                    Number(p.netGen) >= 0 ? "text-neon-green" : "text-neon-pink"
                  }`}>
                    {Number(p.netGen) >= 0 ? "+" : ""}{p.netGen} TRI
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg buy price: {formatAverageBuyPrice(p)} {p.symbol}/TRI
                    {getInverseAverageBuyPrice(p) ? ` • ${getInverseAverageBuyPrice(p)} TRI/${p.symbol}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="card">
        <p className="label mb-1">{t("player.portfolio.txHistory")}</p>
        <p className="text-xs text-gray-500 mb-4">
          {t("player.portfolio.txHistoryDesc")}
        </p>
        {histLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">{t("player.portfolio.noTransactions")}</p>
        ) : (
          <div className="space-y-2">
            {events.map((e, i) => {
              const isBuy = e.type === "BUY";
              const assetDecimals = e.assetSymbol === "ETH" ? 18 : 6;

              return (
                <div
                  key={`${e.txHash}-${i}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isBuy ? "bg-neon-green/10" : "bg-neon-pink/10"
                      }`}
                    >
                      {isBuy ? (
                        <ArrowDownLeft size={14} className="text-neon-green" />
                      ) : (
                        <ArrowUpRight size={14} className="text-neon-pink" />
                      )}
                    </div>
                    <div>
                      <span className={isBuy ? "badge-buy" : "badge-sell"}>{e.type}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        Block {e.block}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {isBuy ? (
                      <p className="text-sm font-mono">
                        <span className="text-gray-400">
                          {formatAmount(e.amountIn, assetDecimals)} {e.assetSymbol}
                        </span>
                        <span className="text-gray-600 mx-1.5">→</span>
                        <span className="text-neon-green">
                          {formatAmount(e.amountOut, 18)} TRI
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm font-mono">
                        <span className="text-gray-400">
                          {formatAmount(e.amountIn, 18)} TRI
                        </span>
                        <span className="text-gray-600 mx-1.5">→</span>
                        <span className="text-neon-pink">
                          {formatAmount(e.amountOut, assetDecimals)} {e.assetSymbol}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(e.timestamp)}
                    </p>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {(() => {
                        const feeDetails = calculateEventFee(e, feeBps);
                        if (!feeDetails) {
                          return null;
                        }

                        return (
                          <>
                            <p>
                              Fee: {formatDisplayNumber(feeDetails.feeAmount)}{" "}
                              {feeDetails.feeSymbol}
                            </p>
                            <p>
                              Net after fee: {formatDisplayNumber(feeDetails.netAmount)}{" "}
                              {feeDetails.netSymbol}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[11px] text-gray-600 mt-0.5">
                      <span>{timeAgo(e.timestamp)}</span>
                      <span>•</span>
                      <span className="font-mono">{shortenTxHash(e.txHash)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAverageBuyPrice(position) {
  const average = getAverageBuyPriceValue(position);
  if (average === null) {
    return "—";
  }

  return average >= 1 ? average.toFixed(6) : average.toPrecision(4);
}

function getAverageBuyPriceValue(position) {
  const totalGenOut = Number(position.totalGenOut || 0);
  if (!Number.isFinite(totalGenOut) || totalGenOut <= 0) {
    return null;
  }

  const assetDecimals = position.symbol === "ETH" ? 18 : 6;
  const totalPaid = Number(formatAmount(position.totalPaidIn, assetDecimals));
  if (!Number.isFinite(totalPaid)) {
    return null;
  }

  return totalPaid / totalGenOut;
}

function getInverseAverageBuyPrice(position) {
  const average = getAverageBuyPriceValue(position);
  if (average === null || average <= 0) {
    return null;
  }

  const inverse = 1 / average;
  return inverse >= 1 ? inverse.toFixed(4) : inverse.toPrecision(4);
}

function getCurrentTriPriceEth(config) {
  const sellRate = Number(config?.rates?.eth?.sellRate);
  if (!Number.isFinite(sellRate) || sellRate <= 0) {
    return null;
  }

  return 1 / sellRate;
}

function syncStatusKey(syncing) {
  return syncing ? "syncing" : "idle";
}

function getPnlStatus(unrealizedPnlEth) {
  if (unrealizedPnlEth === null || unrealizedPnlEth === undefined) {
    return "player.portfolio.needEthHistory";
  }

  if (Math.abs(unrealizedPnlEth) < 0.000001) {
    return "player.portfolio.breakEven";
  }

  if (unrealizedPnlEth > 0) {
    return "player.portfolio.inProfit";
  }

  return "player.portfolio.atLoss";
}

function formatValuationSource(source) {
  if (source === "manual_env_snapshot") {
    return "manual backend snapshot";
  }

  return "unconfigured";
}
