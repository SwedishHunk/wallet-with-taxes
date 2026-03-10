import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getGameDetails,
  getGameWallet,
  depositToWallet,
  withdrawFromWallet,
  getPlayerNFTs,
} from "../lib/platform";
import { setAuthToken } from "../lib/api";
import { ROUTES } from "../routes";
import "../style/Bright.css";
import PersonalAccountHeader from "../components/PersonalAccountHeader";

function fmtNum(value: string | number, decimals = 2) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(n);
}

interface Game {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface Wallet {
  id: string;
  balance: string;
  totalDeposited: string;
  totalWithdrawn: string;
}

interface NFT {
  id: string;
  name: string;
  template: {
    id: string;
    name: string;
    tier: number;
  };
  level: number;
  condition: number;
  power: number;
  equipped: boolean;
  customAttributes: Record<string, unknown>;
  createdAt: string;
}

export function GameControl() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const studioId = localStorage.getItem("studioId");

    if (!token) {
      navigate(ROUTES.root);
      return;
    }

    if (!studioId) {
      navigate(ROUTES.studios);
      return;
    }

    setAuthToken(token);

    if (!gameId) return;
    loadGameData();
  }, [gameId, navigate]);

  const handlePersonalLogout = () => {
    localStorage.removeItem("personalUser");
    navigate(ROUTES.accountLogin);
  };

  const loadGameData = async () => {
    try {
      setLoading(true);
      setError("");
      const gameRes = await getGameDetails(gameId!);
      setGame(gameRes.data);

      const walletRes = await getGameWallet(gameId!);
      setWallet(walletRes.data);

      const nftRes = await getPlayerNFTs(gameId!);
      setNfts(nftRes.data || []);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load game data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError("Enter a valid deposit amount");
      return;
    }
    try {
      setError("");
      await depositToWallet(gameId!, depositAmount);
      setSuccess(`Deposited ${depositAmount} credits!`);
      setDepositAmount("");
      loadGameData();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Deposit failed. Try again?"
      );
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError("Enter a valid withdrawal amount");
      return;
    }
    try {
      setError("");
      const amountNum = parseFloat(withdrawAmount);
      const balanceNum = wallet ? parseFloat(wallet.balance) : 0;

      if (amountNum > balanceNum) {
        const shortage = (amountNum - balanceNum).toFixed(2);
        setError(
          `Not enough credits! You tried to withdraw ${shortage} more than you have.`,
        );
        return;
      }

      await withdrawFromWallet(gameId!, withdrawAmount);
      setSuccess(`Withdrew ${withdrawAmount} credits!`);
      setWithdrawAmount("");
      loadGameData();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Withdrawal failed. Try again?";
      if (message.includes("Insufficient")) {
        setError(`Not enough credits! Check your balance and try again.`);
      } else {
        setError(message);
      }
    }
  };

  if (loading) return <div style={{ padding: "20px" }}>Loading...</div>;

  return (
    <div>
      <PersonalAccountHeader onLogoutPersonal={handlePersonalLogout} />
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
        {/* Fixed alert container - reserves space */}
        <div style={{ minHeight: "54px", marginBottom: "16px" }}>
          {error && (
            <div className="bright-alert bright-alert-error">{error}</div>
          )}
          {success && (
            <div className="bright-alert bright-alert-success">{success}</div>
          )}
        </div>

        <div className="bright-header">
          <h1>Game Wallet</h1>
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className="bright-button bright-button-secondary">
            ← Back to Games
          </button>
        </div>

        <div className="bright-card">
          <h2 className="bright-section-title">{game?.name || "Loading..."}</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <span className="bright-text-secondary">Slug:</span>{" "}
              <strong>{game?.slug}</strong>
            </div>
            <div>
              <span className="bright-text-secondary">Status:</span>{" "}
              <span className="bright-badge bright-badge-success">
                {game?.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bright-card">
          <h3 className="bright-section-title">Wallet Balance</h3>
          <div style={{ marginBottom: "16px" }}>
            <div className="bright-text-large">
              {wallet ? fmtNum(wallet.balance) : "0.00"} Credits
            </div>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="bright-text-secondary">Total Deposited:</span>
              <strong>
                {wallet ? fmtNum(wallet.totalDeposited) : "0.00"}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="bright-text-secondary">Total Withdrawn:</span>
              <strong>
                {wallet ? fmtNum(wallet.totalWithdrawn) : "0.00"}
              </strong>
            </div>
          </div>
        </div>

        <div className="bright-grid-2">
          <div className="bright-card">
            <h4 className="bright-section-title">Deposit Credits</h4>
            <input
              type="number"
              placeholder="Enter amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="bright-input"
              style={{ marginBottom: "12px" }}
            />
            <button
              onClick={handleDeposit}
              className="bright-button bright-button-success"
              style={{ width: "100%" }}>
              Deposit
            </button>
          </div>

          <div className="bright-card">
            <h4 className="bright-section-title">Withdraw Credits</h4>
            <input
              type="number"
              placeholder="Enter amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="bright-input"
              style={{ marginBottom: "12px" }}
            />
            <button
              onClick={handleWithdraw}
              className="bright-button bright-button-danger"
              style={{ width: "100%" }}>
              Withdraw
            </button>
          </div>
        </div>

        <div className="bright-card">
          <h3 className="bright-section-title">💎 My Collectibles</h3>
          {nfts.length === 0 ? (
            <p className="bright-text-secondary">
              No collectibles yet. Check back soon!
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "16px",
              }}>
              {nfts.map((nft) => (
                <div
                  key={nft.id}
                  style={{
                    padding: "16px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    background: nft.equipped ? "#fff3e0" : "#fafafa",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}>
                  <div
                    style={{
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}>
                    <span style={{ fontSize: "20px" }}>✨</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>
                        {nft.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {nft.template.name}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      lineHeight: "1.6",
                      color: "var(--muted)",
                    }}>
                    <div>
                      ⭐ Level: <strong>{nft.level}</strong>
                    </div>
                    <div>
                      💪 Power: <strong>{nft.power}</strong>
                    </div>
                    <div>
                      🛡️ Condition: <strong>{nft.condition}%</strong>
                    </div>
                    {nft.equipped && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "4px 8px",
                          background: "#ff9800",
                          color: "white",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}>
                        ✓ EQUIPPED
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
