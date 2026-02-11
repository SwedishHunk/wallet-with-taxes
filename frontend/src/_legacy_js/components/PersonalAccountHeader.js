import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getStudios } from "../lib/users";
export default function PersonalAccountHeader({ studioName, onLogoutPersonal, }) {
    const [personalUser, setPersonalUser] = useState(null);
    const [resolvedStudioName, setResolvedStudioName] = useState(studioName);
    const [showNotification, setShowNotification] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        const stored = localStorage.getItem("personalUser");
        if (stored) {
            try {
                setPersonalUser(JSON.parse(stored));
            }
            catch (err) {
                console.error("Failed to parse personal user:", err);
            }
        }
    }, []);
    useEffect(() => {
        // If no studioName provided, try to resolve via API using studioId
        const resolveStudio = async () => {
            try {
                const studioId = localStorage.getItem("studioId");
                if (!studioId)
                    return;
                const res = await getStudios();
                const studios = res.data || [];
                const match = studios.find((s) => String(s.id) === String(studioId));
                if (match)
                    setResolvedStudioName(match.name || match.email || "Studio");
            }
            catch (err) {
                // Fallback to generic label
                setResolvedStudioName(studioName || "Studio");
            }
        };
        if (!studioName) {
            void resolveStudio();
        }
        else {
            setResolvedStudioName(studioName);
        }
    }, [studioName]);
    const handleLogout = () => {
        localStorage.removeItem("personalUser");
        setShowNotification(true);
        // Wait 1 second to show notification, then redirect
        setTimeout(() => {
            if (onLogoutPersonal) {
                onLogoutPersonal();
            }
            else {
                navigate("/account-login");
            }
        }, 1000);
    };
    if (!personalUser)
        return null;
    return (_jsxs(_Fragment, { children: [showNotification && (_jsx("div", { style: {
                    position: "fixed",
                    top: "20px",
                    right: "20px",
                    backgroundColor: "#4caf50",
                    color: "white",
                    padding: "16px 24px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    zIndex: 9999,
                    fontWeight: 600,
                }, children: "\u2713 Logged out successfully" })), _jsxs("div", { style: {
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: "12px", color: "#666", textTransform: "uppercase" }, children: resolvedStudioName ? `STUDIO: ${resolvedStudioName}` : "STUDIO" }), _jsxs("div", { style: { fontSize: "14px", fontWeight: 600, marginTop: "4px" }, children: ["\uD83D\uDCE7 ", personalUser.email] }), personalUser.role && (_jsxs("div", { style: { fontSize: "12px", color: "#999", marginTop: "2px" }, children: ["Role: ", personalUser.role.toUpperCase()] }))] }), _jsx("button", { onClick: handleLogout, className: "btn btn-secondary", style: { marginBottom: 0 }, children: "Logout Personal Account" })] })] }));
}
