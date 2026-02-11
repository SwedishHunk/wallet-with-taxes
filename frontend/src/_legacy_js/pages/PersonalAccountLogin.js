import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginPersonalAccount, getPersonalAccounts, createPersonalAccount, } from "../lib/platform";
export default function PersonalAccountLogin() {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState(location.state?.email || "");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [mode, setMode] = useState(location.state?.mode || "login");
    const [createEmail, setCreateEmail] = useState(location.state?.email || "");
    const [createPassword, setCreatePassword] = useState("");
    const [createConfirm, setCreateConfirm] = useState("");
    const [createLoading, setCreateLoading] = useState(false);
    useEffect(() => {
        // Load available personal accounts for this studio so user can pick one and log in
        const fetchAccounts = async () => {
            try {
                const res = await getPersonalAccounts();
                setAccounts(res.data || []);
                if (!email && res.data && res.data.length === 1) {
                    setEmail(res.data[0].email);
                }
                if ((res.data?.length || 0) === 0) {
                    setMode("create");
                }
            }
            catch (err) {
                console.error("Error loading personal accounts", err);
            }
        };
        fetchAccounts();
    }, [email]);
    const disableSubmit = useMemo(() => loading || createLoading, [loading, createLoading]);
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        if (!email || !password) {
            setError("Email and password are required");
            return;
        }
        setLoading(true);
        try {
            const response = await loginPersonalAccount({ email, password });
            // Store the personal account info in localStorage
            localStorage.setItem("personalUser", JSON.stringify({
                id: response.data.id,
                email: response.data.email,
                role: response.data.role,
                accessPoints: response.data.accessPoints,
            }));
            // Redirect to dashboard
            navigate("/dashboard");
        }
        catch (err) {
            console.error("Error logging in:", err);
            setError(err.response?.data?.message ||
                "Invalid credentials. Please try again.");
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        if (!createEmail || !createPassword) {
            setError("Email and password are required");
            return;
        }
        if (createPassword !== createConfirm) {
            setError("Passwords do not match");
            return;
        }
        if (createPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        setCreateLoading(true);
        try {
            await createPersonalAccount({ email: createEmail, password: createPassword });
            setMessage("Account created successfully. Please log in.");
            setEmail(createEmail);
            setPassword("");
            setMode("login");
            // Refresh account list
            const res = await getPersonalAccounts();
            setAccounts(res.data || []);
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to create account. Please try again.");
        }
        finally {
            setCreateLoading(false);
        }
    };
    return (_jsx("div", { className: "container", style: { marginTop: "40px" }, children: _jsxs("div", { className: "card", style: { maxWidth: "500px", margin: "0 auto" }, children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { children: "Personal Accounts" }), _jsx("p", { style: { margin: "8px 0 0", fontSize: "13px", color: "#666" }, children: mode === "login"
                                ? "Select or enter a personal account to log in."
                                : "Create a new personal account for this studio." })] }), _jsxs("div", { className: "card-body", children: [error && _jsx("div", { className: "alert alert-error", children: error }), message && _jsx("div", { className: "alert alert-success", children: message }), accounts.length > 0 && (_jsxs("div", { style: { marginBottom: "12px", fontSize: "13px", color: "#444" }, children: [mode === "login"
                                    ? "Need to create another? "
                                    : "Already have one? ", _jsx("button", { type: "button", className: "link-button", onClick: () => setMode(mode === "login" ? "create" : "login"), disabled: disableSubmit, style: { padding: 0, marginLeft: "4px" }, children: mode === "login" ? "Create account" : "Log in instead" })] })), accounts.length > 0 && (_jsxs("div", { style: { marginBottom: "16px" }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: "8px" }, children: "Select an account to fill email:" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: "8px" }, children: accounts.map((acct) => (_jsxs("button", { type: "button", className: "btn", style: { textAlign: "left" }, onClick: () => setEmail(acct.email), children: [_jsx("div", { children: _jsx("strong", { children: acct.email }) }), _jsxs("div", { style: { fontSize: "12px", color: "#666" }, children: ["Role: ", acct.role] })] }, acct.id))) })] })), mode === "login" && (_jsxs("form", { onSubmit: handleLoginSubmit, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "email", children: "Email Address" }), _jsx("input", { type: "email", id: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "Enter your email", disabled: loading, autoFocus: true })] }), _jsxs("div", { className: "form-group", style: { marginTop: "12px" }, children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { type: "password", id: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter your password", disabled: loading })] }), _jsx("button", { type: "submit", disabled: loading, className: "btn btn-primary", style: { width: "100%", marginTop: "20px" }, children: loading ? "Logging in..." : "Login" })] })), mode === "create" && (_jsxs("form", { onSubmit: handleCreateSubmit, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "createEmail", children: "Email Address" }), _jsx("input", { type: "email", id: "createEmail", value: createEmail, onChange: (e) => setCreateEmail(e.target.value), placeholder: "your@email.com", disabled: createLoading, autoFocus: true })] }), _jsxs("div", { className: "form-group", style: { marginTop: "12px" }, children: [_jsx("label", { htmlFor: "createPassword", children: "Password" }), _jsx("input", { type: "password", id: "createPassword", value: createPassword, onChange: (e) => setCreatePassword(e.target.value), placeholder: "Enter password", disabled: createLoading })] }), _jsxs("div", { className: "form-group", style: { marginTop: "12px" }, children: [_jsx("label", { htmlFor: "createConfirm", children: "Confirm Password" }), _jsx("input", { type: "password", id: "createConfirm", value: createConfirm, onChange: (e) => setCreateConfirm(e.target.value), placeholder: "Confirm password", disabled: createLoading })] }), _jsx("button", { type: "submit", disabled: createLoading, className: "btn btn-primary", style: { width: "100%", marginTop: "20px" }, children: createLoading ? "Creating..." : "Create account" })] }))] })] }) }));
}
