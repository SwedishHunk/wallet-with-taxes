import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudios } from "../lib/users";
import { getPersonalAccounts } from "../lib/platform";
import { setAuthToken } from "../lib/api";
import "../style/Bright.css";
export default function StudioSelector() {
    const [studios, setStudios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/");
            return;
        }
        setAuthToken(token);
        loadStudios();
    }, [navigate]);
    const loadStudios = async () => {
        try {
            setLoading(true);
            const res = await getStudios();
            setStudios(res.data || []);
            // If only one studio, auto-select it
            if (res.data && res.data.length === 1) {
                selectStudio(res.data[0].id);
            }
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to load studios");
            console.error(err);
        }
        finally {
            setLoading(false);
        }
    };
    const selectStudio = async (studioId) => {
        localStorage.setItem("studioId", studioId);
        try {
            // Check if personal accounts exist
            const res = await getPersonalAccounts();
            const personalAccounts = res.data || [];
            if (personalAccounts.length === 0) {
                // No accounts - go to create first account
                navigate("/create-first-account");
            }
            else {
                // Accounts exist - go to personal account login
                navigate("/account-login");
            }
        }
        catch (err) {
            console.error("Error checking personal accounts:", err);
            // On error, go to create first account as fallback
            navigate("/create-first-account");
        }
    };
    if (loading)
        return _jsx("div", { style: { padding: "20px" }, children: "Loading your studios..." });
    if (error) {
        return (_jsxs("div", { style: { padding: "24px", maxWidth: "600px", margin: "0 auto" }, children: [_jsx("div", { className: "bright-alert bright-alert-error", children: error }), _jsx("button", { onClick: () => {
                        localStorage.removeItem("token");
                        setAuthToken(null);
                        navigate("/");
                    }, className: "bright-button bright-button-secondary", style: { marginTop: "16px" }, children: "Back to Login" })] }));
    }
    return (_jsxs("div", { style: { padding: "24px", maxWidth: "600px", margin: "0 auto" }, children: [_jsx("div", { className: "bright-header", style: { marginBottom: "32px" }, children: _jsx("h1", { children: "Select a Studio" }) }), studios.length === 0 ? (_jsxs("div", { className: "bright-card", children: [_jsx("p", { className: "bright-text-secondary", children: "No studios found. Create your first one!" }), _jsx("button", { onClick: () => navigate("/create-studio"), className: "bright-button bright-button-primary", style: { marginTop: "16px" }, children: "Create First Studio" })] })) : (_jsxs("div", { style: { display: "grid", gap: "16px" }, children: [studios.map((studio) => (_jsx("div", { onClick: () => selectStudio(studio.id), className: "bright-card", style: {
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            padding: "20px",
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                            e.currentTarget.style.transform = "translateY(-2px)";
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.boxShadow = "none";
                            e.currentTarget.style.transform = "translateY(0)";
                        }, children: _jsxs("div", { style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }, children: [_jsxs("div", { children: [_jsx("h3", { style: {
                                                margin: "0 0 8px 0",
                                                fontSize: "18px",
                                                fontWeight: "600",
                                            }, children: studio.name }), _jsx("p", { style: { margin: "0", color: "#999", fontSize: "14px" }, children: studio.email }), _jsx("div", { style: { marginTop: "8px" }, children: _jsx("span", { className: `bright-badge ${studio.role === "owner"
                                                    ? "bright-badge-success"
                                                    : studio.role === "admin"
                                                        ? "bright-badge-info"
                                                        : "bright-badge-secondary"}`, style: { fontSize: "12px" }, children: studio.role.toUpperCase() }) })] }), _jsx("div", { style: { fontSize: "28px" }, children: "\u2192" })] }) }, studio.id))), _jsx("button", { onClick: () => navigate("/create-studio"), className: "bright-button bright-button-secondary", style: { marginTop: "24px", width: "100%" }, children: "+ Create New Studio" })] })), _jsx("button", { onClick: () => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("studioId");
                    setAuthToken(null);
                    navigate("/");
                }, className: "bright-button bright-button-danger", style: { marginTop: "32px", width: "100%" }, children: "Logout" })] }));
}
