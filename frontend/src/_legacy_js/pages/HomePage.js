import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPersonalAccounts } from "../lib/platform";
import { setAuthToken } from "../lib/api";
export default function HomePage() {
    const navigate = useNavigate();
    const [personalAccounts, setPersonalAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await getPersonalAccounts();
                setPersonalAccounts(response.data);
            }
            catch (err) {
                console.error("Error fetching accounts:", err);
                setError(err.response?.data?.message || "Failed to load accounts");
            }
            finally {
                setLoading(false);
            }
        };
        fetchAccounts();
    }, []);
    const handleCreateFirstAccount = () => {
        navigate("/create-first-account");
    };
    const handleLogoutAll = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("studioId");
        localStorage.removeItem("personalUser");
        setAuthToken(null);
        navigate("/");
    };
    const handleLoginToAccount = (email) => {
        navigate("/account-login", { state: { email } });
    };
    if (loading) {
        return _jsx("div", { className: "container", children: "Loading..." });
    }
    return (_jsx("div", { className: "container", style: { marginTop: "40px" }, children: _jsxs("div", { className: "card", style: { maxWidth: "600px", margin: "0 auto" }, children: [_jsx("div", { className: "card-header", children: _jsx("h2", { children: "Welcome to Your Studio" }) }), _jsxs("div", { className: "card-body", children: [error && _jsx("div", { className: "alert alert-error", children: error }), personalAccounts.length === 0 ? (
                        // No accounts yet - show create first account
                        _jsxs("div", { children: [_jsx("p", { children: "No personal accounts created yet. Create your first account to get started." }), _jsx("button", { onClick: handleCreateFirstAccount, className: "btn btn-primary", style: { width: "100%", marginTop: "20px" }, children: "Create First Account" })] })) : (
                        // Accounts exist - show login options
                        _jsxs("div", { children: [_jsx("p", { style: { marginBottom: "30px" }, children: "Select an account to log in:" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: personalAccounts.map((account) => (_jsx("button", { onClick: () => handleLoginToAccount(account.email), className: "btn", style: {
                                            padding: "15px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            backgroundColor: "#f5f5f5",
                                            transition: "background-color 0.2s",
                                        }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "#e8e8e8"), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "#f5f5f5"), children: _jsxs("div", { style: { textAlign: "left" }, children: [_jsx("strong", { children: account.email }), _jsxs("div", { style: { fontSize: "12px", color: "#666", marginTop: "4px" }, children: ["Role: ", account.role] })] }) }, account.id))) }), personalAccounts.some((a) => a.role === "admin") && (_jsx("button", { onClick: () => navigate("/personal-accounts"), className: "btn btn-secondary", style: { width: "100%", marginTop: "20px" }, children: "Manage Accounts" })), _jsx("button", { onClick: handleLogoutAll, className: "btn btn-secondary", style: { width: "100%", marginTop: "12px" }, children: "Log Out" })] }))] })] }) }));
}
