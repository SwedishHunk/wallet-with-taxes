import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPersonalAccount, getPersonalAccounts, updatePersonalAccountPermissions } from "../lib/platform";
import { setAuthToken } from "../lib/api";
import PersonalAccountHeader from "../components/PersonalAccountHeader";
import "../style/Bright.css";
import "../style/Dashboard.css";
export default function PersonalAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editAccessPoints, setEditAccessPoints] = useState({});
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const handleLogoutPersonal = () => {
        // Clear form and reset to fresh state
        setEmail("");
        setPassword("");
        setMessage(null);
        setEditingId(null);
        setEditAccessPoints({});
    };
    const personalUser = localStorage.getItem("personalUser");
    useEffect(() => {
        if (!token) {
            navigate("/");
            return;
        }
        // Set auth token in axios headers on mount or when token changes
        setAuthToken(token);
        // Check if personal user is logged in
        if (!personalUser) {
            navigate("/home");
            return;
        }
        // Check if user has ADMIN role
        try {
            const user = JSON.parse(personalUser);
            if (user.role !== "admin") {
                navigate("/dashboard");
                return;
            }
        }
        catch (err) {
            navigate("/home");
            return;
        }
        fetchAccounts();
    }, []);
    const fetchAccounts = async () => {
        try {
            const { data } = await getPersonalAccounts();
            setAccounts(data);
        }
        catch (err) {
            console.error("Error fetching accounts:", err);
        }
    };
    const handleCreate = async () => {
        if (!email || !password) {
            setMessage({ type: "error", text: "Please enter email and password" });
            return;
        }
        setLoading(true);
        try {
            await createPersonalAccount({ email, password });
            setMessage({ type: "success", text: "Personal account created successfully!" });
            setEmail("");
            setPassword("");
            fetchAccounts();
        }
        catch (err) {
            setMessage({ type: "error", text: "Failed to create account" });
            console.error(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleEditPermissions = (account) => {
        setEditingId(account.id);
        setEditAccessPoints({ ...account.accessPoints });
    };
    const handleSavePermissions = async (userId) => {
        try {
            await updatePersonalAccountPermissions(userId, editAccessPoints);
            setMessage({ type: "success", text: "Permissions updated successfully!" });
            setEditingId(null);
            fetchAccounts();
        }
        catch (err) {
            setMessage({ type: "error", text: "Failed to update permissions" });
            console.error(err);
        }
    };
    const handleToggleAccessPoint = (key) => {
        setEditAccessPoints((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };
    return (_jsxs("div", { children: [_jsx(PersonalAccountHeader, { onLogoutPersonal: handleLogoutPersonal }), _jsxs("div", { style: { maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }, children: [_jsx("h1", { className: "dashboard-title", children: "Personal Accounts" }), _jsx("button", { onClick: () => navigate("/dashboard"), className: "bright-button bright-button-secondary", children: "Back to Dashboard" })] }), _jsxs("div", { className: "border p-4 rounded shadow", style: { marginBottom: "24px" }, children: [_jsx("h2", { style: { fontSize: "1.25rem", fontWeight: "600", marginBottom: "16px" }, children: "Create Personal Account" }), _jsx("div", { style: { minHeight: 44 }, children: message && (_jsx("div", { className: `bright-alert ${message.type === "success" ? "bright-alert-success" : "bright-alert-error"}`, style: { marginBottom: "12px" }, children: message.text })) }), _jsxs("div", { style: { display: "flex", gap: "12px", marginBottom: "12px" }, children: [_jsx("input", { type: "email", placeholder: "Email", className: "login-input", value: email, onChange: (e) => setEmail(e.target.value), style: { flex: 1 } }), _jsx("input", { type: "password", placeholder: "Password", className: "login-input", value: password, onChange: (e) => setPassword(e.target.value), style: { flex: 1 } }), _jsx("button", { onClick: handleCreate, className: "bright-button", disabled: loading, children: loading ? "Creating..." : "Create" })] })] }), _jsxs("div", { className: "border p-4 rounded shadow", children: [_jsx("h2", { style: { fontSize: "1.25rem", fontWeight: "600", marginBottom: "16px" }, children: "Team Members" }), accounts.length === 0 ? (_jsx("p", { style: { color: "#999" }, children: "No personal accounts yet." })) : (_jsx("div", { style: { display: "grid", gap: "8px" }, children: accounts.map((account) => (_jsxs("div", { style: {
                                        padding: "12px",
                                        border: "1px solid #ddd",
                                        borderRadius: "8px",
                                    }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: "600" }, children: account.email }), _jsxs("div", { style: { fontSize: "0.875rem", color: "#666" }, children: ["Role: ", _jsx("span", { style: { fontWeight: "600" }, children: account.role })] })] }), _jsx("button", { onClick: () => (editingId === account.id ? handleSavePermissions(account.id) : handleEditPermissions(account)), className: "bright-button bright-button-secondary", style: { fontSize: "0.875rem" }, children: editingId === account.id ? "Save" : "Edit Permissions" })] }), editingId === account.id && (_jsxs("div", { style: { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }, children: [_jsx("div", { style: { fontSize: "0.875rem", fontWeight: "600", marginBottom: "8px" }, children: "Access Points:" }), _jsx("div", { style: { display: "grid", gap: "8px" }, children: Object.keys(editAccessPoints).length === 0 ? (_jsx("div", { style: { fontSize: "0.875rem", color: "#999" }, children: "No access points configured" })) : (Object.entries(editAccessPoints).map(([key, value]) => (_jsxs("label", { style: {
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "8px",
                                                            fontSize: "0.875rem",
                                                            cursor: "pointer",
                                                        }, children: [_jsx("input", { type: "checkbox", checked: value, onChange: () => handleToggleAccessPoint(key), style: { cursor: "pointer" } }), key] }, key)))) }), _jsx("button", { onClick: () => setEditingId(null), className: "bright-button bright-button-secondary", style: { fontSize: "0.875rem", marginTop: "8px" }, children: "Cancel" })] })), editingId !== account.id && (_jsxs("div", { style: { fontSize: "0.875rem", color: "#999" }, children: ["Access Points: ", Object.values(account.accessPoints).filter(Boolean).length, "/", Object.keys(account.accessPoints).length] }))] }, account.id))) }))] })] })] }));
}
