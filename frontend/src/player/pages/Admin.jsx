import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useLanguage } from "../../lib/LanguageContext";
import { useContracts } from "../hooks/useContracts";
import { useApiData } from "../hooks/useApi";
import { formatTxError } from "../formatTxError";
import {
  Shield,
  Pause,
  Play,
  DollarSign,
  TrendingUp,
  Gauge,
  Download,
  Settings,
  CheckCircle,
  AlertTriangle,
  Lock,
  Layers,
} from "lucide-react";

function AdminAction({ title, icon: Icon, children, color = "purple" }) {
  const borderMap = {
    purple: "border-neon-purple/20",
    pink: "border-neon-pink/20",
    green: "border-neon-green/20",
    cyan: "border-neon-cyan/20",
  };
  return (
    <div className={`card border ${borderMap[color]}`} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-gray-400" />
        <h3 className="text-sm font-bold text-gray-200">{title}</h3>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
        {children}
      </div>
    </div>
  );
}

function TxResult({ status, message }) {
  if (!status) return null;
  return (
    <div
      className={`mt-3 p-2.5 rounded-lg border text-xs ${
        status === "success"
          ? "bg-neon-green/5 border-neon-green/20 text-neon-green"
          : status === "error"
          ? "bg-neon-pink/5 border-neon-pink/20 text-neon-pink"
          : "bg-neon-cyan/5 border-neon-cyan/20 text-neon-cyan"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {status === "success" ? (
          <CheckCircle size={12} />
        ) : status === "error" ? (
          <AlertTriangle size={12} />
        ) : (
          <div className="w-3 h-3 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const { t } = useLanguage();
  const { isConnected, isAdmin } = useWallet();
  const { getShop, ready } = useContracts();
  const { data: config, refresh: refreshConfig } = useApiData("/shop/config");
  const { data: liquidity, refresh: refreshLiquidity } = useApiData("/shop/liquidity");

  // Form states
  const [feeBps, setFeeBps] = useState("");
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [rateAsset, setRateAsset] = useState("0x0000000000000000000000000000000000000000");
  const [maxEthIn, setMaxEthIn] = useState("");
  const [maxGenIn, setMaxGenIn] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Per-action status
  const [pauseStatus, setPauseStatus] = useState(null);
  const [pauseMsg, setPauseMsg] = useState("");
  const [feeStatus, setFeeStatus] = useState(null);
  const [feeMsg, setFeeMsg] = useState("");
  const [rateStatus, setRateStatus] = useState(null);
  const [rateMsg, setRateMsg] = useState("");
  const [limitStatus, setLimitStatus] = useState(null);
  const [limitMsg, setLimitMsg] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState(null);
  const [withdrawMsg, setWithdrawMsg] = useState("");

  // Pre-fill from config
  useEffect(() => {
    if (config) {
      setFeeBps(String(config.feeBps || 0));
    }
  }, [config]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Lock size={40} className="text-gray-500 mb-6" />
        <h2 className="text-xl font-bold text-gray-300 mb-2">{t("player.admin.title")}</h2>
        <p className="text-gray-500 text-sm">{t("player.admin.connectMsg")}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Shield size={40} className="text-neon-pink mb-6" />
        <h2 className="text-xl font-bold text-gray-300 mb-2">{t("player.admin.accessDenied")}</h2>
        <p className="text-gray-500 text-sm">
          {t("player.admin.adminOnly")}
        </p>
      </div>
    );
  }

  async function execTx(fn, setStatus, setMsg) {
    setStatus("pending");
    setMsg(t("player.admin.confirmWallet"));
    try {
      const shop = getShop();
      if (!shop) {
        throw new Error(
          "TokenShop contract is not ready yet. Verify wallet connection and shop config."
        );
      }
      const tx = await fn(shop);
      setMsg(t("player.admin.waitConfirm"));
      await tx.wait();
      setStatus("success");
      setMsg(t("player.admin.txConfirmed"));
      refreshConfig();
      refreshLiquidity();
    } catch (err) {
      setStatus("error");
      const reason = formatTxError(err, "Failed");
      setMsg(reason.length > 80 ? reason.slice(0, 80) + "..." : reason);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield size={28} className="text-neon-purple" />
          <span className="glow-text-purple">{t("player.admin.title")}</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t("player.admin.subtitle")}
        </p>
      </div>

      {/* Current Status */}
      {config && (
        <div className="card mb-6 border border-dark-500">
          <p className="label mb-3 flex items-center gap-2">
            <Settings size={14} />
            {t("player.admin.currentConfig")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t("player.admin.status")}</p>
              <p className={`text-sm font-bold ${config.paused ? "text-neon-pink" : "text-neon-green"}`}>
                {config.paused ? "PAUSED" : "ACTIVE"}
              </p>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t("player.admin.fee")}</p>
              <p className="text-sm font-mono">{config.feeBps} bps ({config.feePercent}%)</p>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t("player.admin.buyRate")}</p>
              <p className="text-sm font-mono">{config.rates?.eth?.buyRate}</p>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t("player.admin.maxEthIn")}</p>
              <p className="text-sm font-mono">
                {Number(config.maxEthIn) > 0 ? config.maxEthIn : "Unlimited"}
              </p>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t("player.admin.maxTriIn")}</p>
              <p className="text-sm font-mono">
                {Number(config.maxGenIn) > 0 ? config.maxGenIn : "Unlimited"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Shop Reserves */}
      {liquidity && (
        <div className="card mb-6 border border-dark-500">
          <p className="label mb-3 flex items-center gap-2">
            <Layers size={14} />
            Shop Reserves
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">ETH in Contract</p>
              <p className="text-sm font-mono text-neon-cyan">
                {liquidity.ETH != null ? Number(liquidity.ETH).toFixed(4) : "—"} ETH
              </p>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">TRI in Contract</p>
              <p className="text-sm font-mono text-neon-purple">
                {liquidity.TRI != null ? Number(liquidity.TRI).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} TRI
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions — organized layout */}
      {/* Row 1: Quick actions (Pause + Fee) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" style={{ position: "relative", zIndex: 2 }}>
        {/* Pause / Unpause */}
        <AdminAction title={t("player.admin.pause")} icon={Pause} color="pink">
          <div className="flex gap-2">
            <button
              onClick={() =>
                execTx((shop) => shop.setPaused(true), setPauseStatus, setPauseMsg)
              }
              className="btn-danger flex-1 flex items-center justify-center gap-2"
              disabled={pauseStatus === "pending" || !ready}
            >
              <Pause size={14} /> {t("player.admin.pauseBtn")}
            </button>
            <button
              onClick={() =>
                execTx((shop) => shop.setPaused(false), setPauseStatus, setPauseMsg)
              }
              className="btn-success flex-1 flex items-center justify-center gap-2"
              disabled={pauseStatus === "pending" || !ready}
            >
              <Play size={14} /> {t("player.admin.unpauseBtn")}
            </button>
          </div>
          <TxResult status={pauseStatus} message={pauseMsg} />
        </AdminAction>

        {/* Fee */}
        <AdminAction title={t("player.admin.setFee")} icon={DollarSign} color="cyan">
          <div className="flex gap-2">
            <input
              type="number"
              value={feeBps}
              onChange={(e) => setFeeBps(e.target.value)}
              placeholder="bps (e.g. 100 = 1%)"
              className="input-field flex-1"
              min="0"
              max="1000"
            />
            <button
              onClick={() =>
                execTx(
                  (shop) => shop.setFeeBps(BigInt(feeBps)),
                  setFeeStatus,
                  setFeeMsg
                )
              }
              className="btn-primary"
              disabled={feeStatus === "pending" || !feeBps || !ready}
            >
              {t("player.admin.setBtn")}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {feeBps ? `${Number(feeBps) / 100}% fee` : "0-1000 bps (0%-10%)"}
          </p>
          {!ready && (
            <p className="text-xs text-neon-pink mt-1">
              {t("player.admin.notReady")}
            </p>
          )}
          <TxResult status={feeStatus} message={feeMsg} />
        </AdminAction>
      </div>

      {/* Row 2: Rates, Limits & Withdraw — 3-column row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" style={{ position: "relative", zIndex: 2 }}>
        {/* Rates */}
        <AdminAction title={t("player.admin.setRates")} icon={TrendingUp} color="green">
          <div className="space-y-2">
            <select
              value={rateAsset}
              onChange={(e) => setRateAsset(e.target.value)}
              className="input-field"
            >
              <option value="0x0000000000000000000000000000000000000000">ETH</option>
            </select>
            <input
              type="number"
              value={buyRate}
              onChange={(e) => setBuyRate(e.target.value)}
              placeholder="Buy rate (TRI per 1 unit)"
              className="input-field"
            />
            <input
              type="number"
              value={sellRate}
              onChange={(e) => setSellRate(e.target.value)}
              placeholder="Sell rate (TRI per 1 unit)"
              className="input-field"
            />
          </div>
          <button
            onClick={() =>
              execTx(
                (shop) =>
                  shop.setRates(
                    rateAsset,
                    ethers.parseUnits(buyRate, 18),
                    ethers.parseUnits(sellRate, 18)
                  ),
                setRateStatus,
                setRateMsg
              )
            }
            className="btn-primary w-full"
            style={{ marginTop: "auto" }}
            disabled={rateStatus === "pending" || !buyRate || !sellRate || !ready}
          >
            {t("player.admin.updateRates")}
          </button>
          <TxResult status={rateStatus} message={rateMsg} />
        </AdminAction>

        {/* Limits */}
        <AdminAction title={t("player.admin.limits")} icon={Gauge} color="purple">
          <div className="space-y-2">
            <input
              type="number"
              value={maxEthIn}
              onChange={(e) => setMaxEthIn(e.target.value)}
              placeholder="Max ETH in (0 = unlimited)"
              className="input-field"
              step="any"
            />
            <input
              type="number"
              value={maxGenIn}
              onChange={(e) => setMaxGenIn(e.target.value)}
              placeholder="Max TRI in (0 = unlimited)"
              className="input-field"
              step="any"
            />
          </div>
          <button
            onClick={async () => {
              setLimitStatus("pending");
              setLimitMsg(t("player.admin.confirmWallet"));
              try {
                const shop = getShop();
                if (!shop) {
                  throw new Error(
                    "TokenShop contract is not ready yet. Verify wallet connection and shop config."
                  );
                }
                if (maxEthIn) {
                  const tx = await shop.setMaxEthIn(ethers.parseEther(maxEthIn));
                  await tx.wait();
                }
                if (maxGenIn) {
                  const tx = await shop.setMaxGenIn(ethers.parseUnits(maxGenIn, 18));
                  await tx.wait();
                }
                setLimitStatus("success");
                setLimitMsg(t("player.admin.txConfirmed"));
                refreshConfig();
              } catch (err) {
                setLimitStatus("error");
                setLimitMsg(formatTxError(err, "Failed"));
              }
            }}
            className="btn-primary w-full"
            style={{ marginTop: "auto" }}
            disabled={limitStatus === "pending" || (!maxEthIn && !maxGenIn) || !ready}
          >
            {t("player.admin.updateLimits")}
          </button>
          <TxResult status={limitStatus} message={limitMsg} />
        </AdminAction>

        {/* Withdraw ETH */}
        <AdminAction title={t("player.admin.withdraw")} icon={Download} color="pink">
          <div className="space-y-2">
            <input
              type="text"
              value={withdrawTo}
              onChange={(e) => setWithdrawTo(e.target.value)}
              placeholder="Recipient address (0x...)"
              className="input-field"
            />
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount (ETH)"
              className="input-field"
              step="any"
            />
          </div>
          <button
            onClick={() =>
              execTx(
                (shop) =>
                  shop.withdrawETH(withdrawTo, ethers.parseEther(withdrawAmount)),
                setWithdrawStatus,
                setWithdrawMsg
              )
            }
            className="btn-danger w-full"
            style={{ marginTop: "auto" }}
            disabled={
              withdrawStatus === "pending" || !withdrawTo || !withdrawAmount || !ready
            }
          >
            {t("player.admin.withdrawBtn")}
          </button>
          <TxResult status={withdrawStatus} message={withdrawMsg} />
        </AdminAction>
      </div>
    </div>
  );
}
