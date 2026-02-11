import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useLoginStudio, useLoginMember } from "../lib/useAuth";
import "../style/Bright.css";
import "../style/Login.css";
export default function CreateStudio() {
    const navigate = useNavigate();
    const { loginStudio } = useLoginStudio();
    const { loginMember } = useLoginMember();
    const [studioName, setStudioName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        // Validation
        if (!studioName.trim()) {
            setError("Studio name cannot be empty");
            return;
        }
        if (!email.trim() || !email.includes("@")) {
            setError("Valid email is required");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            const { data } = await signup(email, password, studioName);
            // Save token
            setAuthToken(data.token);
            localStorage.setItem("token", data.token);
            // Set studio session
            loginStudio({
                studioId: data.studio.studioId,
                studioName: data.studio.studioName,
                authenticatedAt: new Date().toISOString(),
            });
            // Set member session (auto-activated as owner)
            loginMember({
                memberId: data.member.memberId,
                userId: data.member.userId,
                studioId: data.member.studioId,
                email: data.member.email,
                isOwner: data.member.isOwner,
                permissions: data.member.permissions,
                gameAccessIds: data.member.gameAccessIds,
                authenticatedAt: new Date().toISOString(),
            });
            // Navigate to dashboard
            navigate("/dashboard", { replace: true });
        }
        catch (err) {
            const message = err.response?.data?.message || "Failed to create studio";
            setError(message);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "login-page", children: _jsxs("div", { className: "login-box", style: { maxWidth: "500px" }, children: [_jsx("h1", { className: "login-title", children: "Skapa studio" }), _jsxs("form", { className: "login-fields", onSubmit: handleSubmit, children: [error && _jsx("div", { className: "bright-alert bright-alert-error", children: error }), _jsx("input", { type: "text", placeholder: "Studio name", className: "login-input", value: studioName, onChange: (e) => setStudioName(e.target.value), required: true, autoFocus: true }), _jsx("input", { type: "email", placeholder: "Email", className: "login-input", value: email, onChange: (e) => setEmail(e.target.value), autoComplete: "username", required: true }), _jsx("input", { type: "password", placeholder: "Password", className: "login-input", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "new-password", required: true }), _jsx("input", { type: "password", placeholder: "Confirm password", className: "login-input", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), autoComplete: "new-password", required: true }), _jsx("button", { type: "submit", className: "login-button", disabled: loading, children: loading ? "Skapar studio..." : "Skapa studio" })] }), _jsxs("p", { className: "login-footer", children: ["Har du redan ett konto?", " ", _jsx("span", { className: "signup-link", onClick: () => navigate("/login"), children: "Logga in" })] })] }) }));
}
