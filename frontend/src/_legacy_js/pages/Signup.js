import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { signup } from "../lib/users";
import { useNavigate } from "react-router-dom";
import "../style/Login.css";
import "../style/Bright.css";
export default function Signup() {
    console.log("🔵 SIGNUP COMPONENT RENDERING");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();
    const handleSignup = async () => {
        if (!email || !password) {
            setMessage({ type: "error", text: "Please enter email and password" });
            return;
        }
        setLoading(true);
        try {
            await signup(email, password);
            // Signup successful - redirect to login
            navigate("/");
        }
        catch (err) {
            const errorMessage = err.response?.data?.message || "Signup failed. Please try again.";
            setMessage({ type: "error", text: errorMessage });
            console.error(err);
            setLoading(false);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSignup();
        }
    };
    return (_jsx("div", { className: "login-page", children: _jsxs("div", { className: "login-box", children: [_jsx("h1", { className: "login-title", children: "Create your account" }), _jsx("div", { style: { minHeight: 44 }, children: message && (_jsx("div", { className: `bright-alert ${message.type === "success" ? "bright-alert-success" : "bright-alert-error"}`, children: message.text })) }), _jsxs("div", { className: "login-fields", children: [_jsx("input", { type: "email", placeholder: "Email", className: "login-input", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: handleKeyDown }), _jsx("input", { type: "password", placeholder: "Password", className: "login-input", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: handleKeyDown }), _jsx("button", { onClick: handleSignup, className: "login-button", disabled: loading, children: loading ? "Creating..." : "Sign Up" })] }), _jsxs("p", { className: "login-footer", children: ["Already have an account?", " ", _jsx("span", { className: "signup-link", onClick: () => navigate("/"), children: "Sign in" })] })] }) }));
}
