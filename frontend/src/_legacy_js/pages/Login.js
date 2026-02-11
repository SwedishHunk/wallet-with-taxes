import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, getStudios, getMemberSession } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useAuthState } from "../lib/AuthContext";
import { useLoginMember, useLoginStudio } from "../lib/useAuth";
import "../style/Login.css";
import "../style/Bright.css";
export default function Login() {
    const navigate = useNavigate();
    const { authContext } = useAuthState();
    const { loginStudio } = useLoginStudio();
    const { loginMember } = useLoginMember();
    const [studioEmail, setStudioEmail] = useState("");
    const [studioPassword, setStudioPassword] = useState("");
    const [studioError, setStudioError] = useState(null);
    const [memberError, setMemberError] = useState(null);
    const [studioLoading, setStudioLoading] = useState(false);
    const [memberLoading, setMemberLoading] = useState(false);
    // Redirect if already fully authenticated
    useEffect(() => {
        if (authContext.state === "Studio+MemberActive") {
            navigate("/dashboard", { replace: true });
        }
    }, [authContext.state, navigate]);
    const handleStudioLogin = async (event) => {
        event?.preventDefault();
        setStudioError(null);
        setStudioLoading(true);
        try {
            const { data } = await login(studioEmail, studioPassword);
            setAuthToken(data.token);
            localStorage.setItem("token", data.token);
            // Fetch studios to resolve name + confirmed studioId
            let studioId = data.user.studioId;
            let studioName = data.user.email;
            try {
                const studiosResponse = await getStudios();
                const studios = studiosResponse.data ?? [];
                const matched = studios.find((s) => s.id === studioId) ?? studios[0];
                if (matched) {
                    studioId = matched.id || studioId;
                    studioName = matched.name || studioName;
                }
            }
            catch (innerErr) {
                console.warn("Could not fetch studios list after login", innerErr);
            }
            loginStudio({
                studioId,
                studioName,
                authenticatedAt: new Date().toISOString(),
            });
            navigate("/dashboard", { replace: true });
        }
        catch (err) {
            const error = err;
            const message = error.response?.data?.message || "Login failed. Please try again.";
            setStudioError(message);
        }
        finally {
            setStudioLoading(false);
        }
    };
    const handleMemberLogin = async () => {
        if (!authContext.studioSession) {
            setMemberError("Logga in på studio först.");
            return;
        }
        setMemberError(null);
        setMemberLoading(true);
        try {
            const { data } = await getMemberSession(authContext.studioSession.studioId);
            loginMember({
                memberId: data.memberId,
                userId: data.userId,
                studioId: data.studioId,
                email: data.email,
                isOwner: data.isOwner,
                permissions: data.permissions ?? [],
                gameAccessIds: data.gameAccessIds ?? [],
                authenticatedAt: new Date().toISOString(),
            });
            navigate("/dashboard", { replace: true });
        }
        catch (err) {
            const error = err;
            const message = error.response?.data?.message || "Member login failed. Please try again.";
            setMemberError(message);
        }
        finally {
            setMemberLoading(false);
        }
    };
    const showStudioForm = authContext.state === "Unauthenticated";
    const showMemberCTA = authContext.state === "StudioAuthenticated";
    return (_jsx("div", { className: "login-page", children: _jsxs("div", { className: "login-grid", children: [_jsxs("div", { className: "login-box", children: [_jsx("h1", { className: "login-title", children: "Studio login" }), showStudioForm ? (_jsxs("form", { className: "login-fields", onSubmit: handleStudioLogin, children: [studioError && _jsx("div", { className: "bright-alert bright-alert-error", children: studioError }), _jsx("input", { type: "email", placeholder: "Email", className: "login-input", value: studioEmail, onChange: (e) => setStudioEmail(e.target.value), autoComplete: "username", required: true }), _jsx("input", { type: "password", placeholder: "Password", className: "login-input", value: studioPassword, onChange: (e) => setStudioPassword(e.target.value), autoComplete: "current-password", required: true }), _jsx("button", { type: "submit", className: "login-button", disabled: studioLoading, children: studioLoading ? "Signing in..." : "Sign in to studio" })] })) : (_jsx("div", { className: "login-note", children: "Studio-session redan aktiv. Forts\u00E4tt till member-login." })), showStudioForm && (_jsxs("p", { className: "login-footer", children: ["Har du ingen studio?", " ", _jsx("span", { className: "signup-link", onClick: () => navigate("/create-studio"), children: "Skapa studio" })] }))] }), showMemberCTA && (_jsxs("div", { className: "login-box login-box-secondary", children: [_jsx("h2", { className: "login-title", children: "Member login" }), memberError && _jsx("div", { className: "bright-alert bright-alert-error", children: memberError }), _jsxs("div", { className: "login-fields", children: [_jsx("div", { className: "login-note", children: authContext.studioSession ? (_jsxs(_Fragment, { children: ["Studio: ", _jsx("strong", { children: authContext.studioSession.studioName })] })) : ("Logga in på en studio först.") }), _jsx("button", { type: "button", className: "login-button", disabled: !authContext.studioSession || memberLoading, onClick: handleMemberLogin, children: memberLoading ? "Activating member..." : "Login as member" })] })] }))] }) }));
}
