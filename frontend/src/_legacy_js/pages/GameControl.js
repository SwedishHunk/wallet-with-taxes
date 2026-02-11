import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getGameDetails, getGameWallet, depositToWallet, withdrawFromWallet, getPlayerNFTs, } from "../lib/platform";
import { setAuthToken } from "../lib/api";
import "../style/Bright.css";
import PersonalAccountHeader from "../components/PersonalAccountHeader";
export function GameControl() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const [game, setGame] = useState(null);
    const [wallet, setWallet] = useState(null);
    const [nfts, setNfts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    useEffect(() => {
        const token = localStorage.getItem("token");
        const studioId = localStorage.getItem("studioId");
        if (!token) {
            navigate("/");
            return;
        }
        if (!studioId) {
            navigate("/studios");
            return;
        }
        setAuthToken(token);
        if (!gameId)
            return;
        loadGameData();
    }, [gameId, navigate]);
    const handlePersonalLogout = () => {
        localStorage.removeItem("personalUser");
        navigate("/account-login");
    };
    const loadGameData = async () => {
        try {
            setLoading(true);
            setError("");
            const gameRes = await getGameDetails(gameId);
            setGame(gameRes.data);
            const walletRes = await getGameWallet(gameId);
            setWallet(walletRes.data);
            const nftRes = await getPlayerNFTs(gameId);
            setNfts(nftRes.data || []);
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to load game data");
        }
        finally {
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
            await depositToWallet(gameId, depositAmount);
            setSuccess(`Deposited ${depositAmount} credits!`);
            setDepositAmount("");
            loadGameData();
            setTimeout(() => setSuccess(""), 2000);
        }
        catch (err) {
            setError(err.response?.data?.message || "Deposit failed. Try again?");
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
                setError(`Not enough credits! You tried to withdraw ${shortage} more than you have.`);
                return;
            }
            await withdrawFromWallet(gameId, withdrawAmount);
            setSuccess(`Withdrew ${withdrawAmount} credits!`);
            setWithdrawAmount("");
            loadGameData();
            setTimeout(() => setSuccess(""), 2000);
        }
        catch (err) {
            const message = err.response?.data?.message || "Withdrawal failed. Try again?";
            if (message.includes("Insufficient")) {
                setError(`Not enough credits! Check your balance and try again.`);
            }
            else {
                setError(message);
            }
        }
    };
    if (loading)
        return _jsx("div", { style: { padding: "20px" }, children: "Loading..." });
    return (_jsxs("div", { children: [_jsx(PersonalAccountHeader, { onLogoutPersonal: handlePersonalLogout }), _jsxs("div", { style: { maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }, children: [_jsxs("div", { style: { minHeight: "54px", marginBottom: "16px" }, children: [error && (_jsx("div", { className: "bright-alert bright-alert-error", children: error })), success && (_jsx("div", { className: "bright-alert bright-alert-success", children: success }))] }), _jsxs("div", { className: "bright-header", children: [_jsx("h1", { children: "Game Wallet" }), _jsx("button", { onClick: () => navigate("/dashboard"), className: "bright-button bright-button-secondary", children: "\u2190 Back to Games" })] }), _jsxs("div", { className: "bright-card", children: [_jsx("h2", { className: "bright-section-title", children: game?.name || "Loading..." }), _jsxs("div", { style: { display: "grid", gap: "12px" }, children: [_jsxs("div", { children: [_jsx("span", { className: "bright-text-secondary", children: "Slug:" }), " ", _jsx("strong", { children: game?.slug })] }), _jsxs("div", { children: [_jsx("span", { className: "bright-text-secondary", children: "Status:" }), " ", _jsx("span", { className: "bright-badge bright-badge-success", children: game?.status })] })] })] }), _jsxs("div", { className: "bright-card", children: [_jsx("h3", { className: "bright-section-title", children: "Wallet Balance" }), _jsx("div", { style: { marginBottom: "16px" }, children: _jsxs("div", { className: "bright-text-large", children: [wallet ? parseFloat(wallet.balance).toFixed(2) : "0.00", " Credits"] }) }), _jsxs("div", { style: { display: "grid", gap: "8px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between" }, children: [_jsx("span", { className: "bright-text-secondary", children: "Total Deposited:" }), _jsx("strong", { children: wallet ? parseFloat(wallet.totalDeposited).toFixed(2) : "0.00" })] }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between" }, children: [_jsx("span", { className: "bright-text-secondary", children: "Total Withdrawn:" }), _jsx("strong", { children: wallet ? parseFloat(wallet.totalWithdrawn).toFixed(2) : "0.00" })] })] })] }), _jsxs("div", { className: "bright-grid-2", children: [_jsxs("div", { className: "bright-card", children: [_jsx("h4", { className: "bright-section-title", children: "Deposit Credits" }), _jsx("input", { type: "number", placeholder: "Enter amount", value: depositAmount, onChange: (e) => setDepositAmount(e.target.value), className: "bright-input", style: { marginBottom: "12px" } }), _jsx("button", { onClick: handleDeposit, className: "bright-button bright-button-success", style: { width: "100%" }, children: "Deposit" })] }), _jsxs("div", { className: "bright-card", children: [_jsx("h4", { className: "bright-section-title", children: "Withdraw Credits" }), _jsx("input", { type: "number", placeholder: "Enter amount", value: withdrawAmount, onChange: (e) => setWithdrawAmount(e.target.value), className: "bright-input", style: { marginBottom: "12px" } }), _jsx("button", { onClick: handleWithdraw, className: "bright-button bright-button-danger", style: { width: "100%" }, children: "Withdraw" })] })] }), _jsxs("div", { className: "bright-card", children: [_jsx("h3", { className: "bright-section-title", children: "\uD83D\uDC8E My Collectibles" }), nfts.length === 0 ? (_jsx("p", { className: "bright-text-secondary", children: "No collectibles yet. Check back soon!" })) : (_jsx("div", { style: {
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: "16px",
                                }, children: nfts.map((nft) => (_jsxs("div", { style: {
                                        padding: "16px",
                                        border: "1px solid #e0e0e0",
                                        borderRadius: "8px",
                                        background: nft.equipped ? "#fff3e0" : "#fafafa",
                                        transition: "all 0.2s ease",
                                        cursor: "pointer",
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.boxShadow =
                                            "0 4px 12px rgba(0,0,0,0.1)";
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.boxShadow = "none";
                                    }, children: [_jsxs("div", { style: {
                                                marginBottom: "8px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }, children: [_jsx("span", { style: { fontSize: "20px" }, children: "\u2728" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: "600", fontSize: "14px" }, children: nft.name }), _jsx("div", { style: { fontSize: "12px", color: "#999" }, children: nft.template.name })] })] }), _jsxs("div", { style: {
                                                fontSize: "12px",
                                                lineHeight: "1.6",
                                                color: "#666",
                                            }, children: [_jsxs("div", { children: ["\u2B50 Level: ", _jsx("strong", { children: nft.level })] }), _jsxs("div", { children: ["\uD83D\uDCAA Power: ", _jsx("strong", { children: nft.power })] }), _jsxs("div", { children: ["\uD83D\uDEE1\uFE0F Condition: ", _jsxs("strong", { children: [nft.condition, "%"] })] }), nft.equipped && (_jsx("div", { style: {
                                                        marginTop: "8px",
                                                        padding: "4px 8px",
                                                        background: "#ff9800",
                                                        color: "white",
                                                        borderRadius: "4px",
                                                        fontSize: "11px",
                                                        fontWeight: "600",
                                                    }, children: "\u2713 EQUIPPED" }))] })] }, nft.id))) }))] })] })] }));
}
