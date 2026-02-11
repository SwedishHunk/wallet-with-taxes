import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "../../lib/AuthContext";
import { useCanManageMembers } from "../../lib/useAuth";
import "../../style/Dashboard.css";
export default function Dashboard() {
    const navigate = useNavigate();
    const { authContext } = useAuthState();
    const canManageMembers = useCanManageMembers();
    const studio = authContext.studioSession;
    const member = authContext.memberSession;
    return (_jsx("div", { className: "dashboard-wrapper", children: _jsxs("div", { className: "dashboard-card", children: [_jsx("div", { className: "dashboard-header", children: _jsxs("div", { children: [_jsx("div", { className: "label", children: "Studio" }), _jsx("div", { className: "value", children: studio?.studioName ?? "Okänd studio" }), _jsxs("div", { className: "meta", children: ["ID: ", studio?.studioId ?? "-"] })] }) }), !member && (_jsxs("div", { className: "dashboard-section", children: [_jsx("div", { className: "section-title", children: "Ingen medlem aktiv" }), _jsx("p", { className: "section-text", children: "Logga in som medlem f\u00F6r att f\u00E5 \u00E5tkomst till admin-funktioner." }), _jsx("button", { className: "bright-button bright-button-primary", onClick: () => navigate("/login"), children: "Logga in som medlem" })] })), member && (_jsxs("div", { className: "dashboard-section", children: [_jsx("div", { className: "section-title", children: "Aktiv medlem" }), _jsx("div", { className: "member-row", children: _jsxs("div", { children: [_jsx("div", { className: "value", children: member.email }), _jsxs("div", { className: "meta", children: ["Member ID: ", member.memberId] }), _jsxs("div", { className: "meta", children: ["User ID: ", member.userId] }), member.isOwner && _jsx("span", { className: "badge", children: "Owner" })] }) }), _jsx("div", { className: "section-subtitle", children: "Permissions" }), _jsxs("div", { className: "pill-row", children: [member.permissions.length === 0 && _jsx("span", { className: "pill muted", children: "Inga" }), member.permissions.map((p) => (_jsx("span", { className: "pill", children: p }, p)))] }), _jsx("div", { className: "actions-row", children: canManageMembers && (_jsx("button", { className: "bright-button bright-button-secondary", onClick: () => navigate("/members"), children: "Hantera medlemmar" })) })] }))] }) }));
}
