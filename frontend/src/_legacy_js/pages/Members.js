import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/useAuth";
import { api } from "../lib/api";
import "../style/Members.css";
export default function Members() {
    const { currentStudio, currentMember, isAuthenticated, studioSession } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        permissions: {
            ManageMembers: false,
            ManageGames: false,
            ManageSettings: false,
            MintNFT: false,
            MakeTransactions: false,
        },
    });
    const canManageMembers = currentMember?.isOwner ||
        currentMember?.permissions.includes("ManageMembers");
    useEffect(() => {
        if (!isAuthenticated || !studioSession)
            return;
        fetchMembers();
    }, [studioSession]);
    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/studios/${studioSession?.studioId}/members`);
            setMembers(data);
            setError("");
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to load members");
        }
        finally {
            setLoading(false);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.email.trim()) {
            setError("Email is required");
            return;
        }
        try {
            const permissionsList = Object.entries(formData.permissions)
                .filter(([_, v]) => v)
                .map(([k, _]) => k);
            const payload = {
                email: formData.email,
                permissions: permissionsList,
            };
            if (formData.password.trim()) {
                payload.password = formData.password;
            }
            await api.post(`/studios/${studioSession?.studioId}/members`, payload);
            setFormData({
                email: "",
                password: "",
                permissions: {
                    ManageMembers: false,
                    ManageGames: false,
                    ManageSettings: false,
                    MintNFT: false,
                    MakeTransactions: false,
                },
            });
            setShowForm(false);
            setError("");
            await fetchMembers();
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to create member");
        }
    };
    if (!isAuthenticated) {
        return _jsx("div", { style: { padding: "24px", color: "#fff" }, children: "Not authenticated" });
    }
    if (!canManageMembers) {
        return (_jsx("div", { style: { padding: "24px", color: "#fff" }, children: _jsx("p", { children: "You don't have permission to manage members." }) }));
    }
    return (_jsxs("div", { className: "members-container", children: [_jsxs("div", { className: "members-header", children: [_jsx("h2", { children: "Hantera medlemmar" }), _jsxs("p", { style: { color: "#9ca3af", marginTop: "4px" }, children: ["Studio: ", _jsx("strong", { children: currentStudio?.studioName })] })] }), error && (_jsx("div", { className: "error-banner", children: _jsx("p", { children: error }) })), _jsx("div", { className: "members-action-bar", children: !showForm ? (_jsx("button", { className: "btn-primary", onClick: () => setShowForm(true), children: "+ L\u00E4gg till medlem" })) : (_jsx("button", { className: "btn-secondary", onClick: () => setShowForm(false), children: "Avbryt" })) }), showForm && (_jsxs("div", { className: "members-form-card", children: [_jsx("h3", { children: "Skapa ny medlem" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Email" }), _jsx("input", { type: "email", value: formData.email, onChange: (e) => setFormData({ ...formData, email: e.target.value }), placeholder: "medlem@example.com", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "L\u00F6senord (frivilligt, genereras om tommt)" }), _jsx("input", { type: "password", value: formData.password, onChange: (e) => setFormData({ ...formData, password: e.target.value }), placeholder: "L\u00E4mna tomt f\u00F6r slumpm\u00E4ssigt l\u00F6senord" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Beh\u00F6righeter" }), _jsx("div", { className: "permissions-grid", children: Object.entries(formData.permissions).map(([perm, checked]) => (_jsxs("div", { className: "permission-checkbox", children: [_jsx("input", { type: "checkbox", id: perm, checked: checked, onChange: (e) => setFormData({
                                                        ...formData,
                                                        permissions: {
                                                            ...formData.permissions,
                                                            [perm]: e.target.checked,
                                                        },
                                                    }) }), _jsx("label", { htmlFor: perm, children: perm })] }, perm))) })] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Skapa medlem" })] })] })), _jsx("div", { className: "members-list", children: loading ? (_jsx("p", { style: { color: "#9ca3af" }, children: "Laddar medlemmar..." })) : members.length === 0 ? (_jsx("p", { style: { color: "#9ca3af" }, children: "Ingen medlemmar \u00E4nnu" })) : (_jsx("div", { className: "members-table", children: members.map((member) => (_jsxs("div", { className: "member-row", children: [_jsxs("div", { className: "member-info", children: [_jsx("p", { className: "member-email", children: member.email }), member.isOwner && (_jsx("span", { className: "badge badge-owner", children: "\u00C4gare" })), !member.isOwner && member.permissions.length > 0 && (_jsx("div", { className: "permissions-list", children: member.permissions.map((p) => (_jsx("span", { className: "badge badge-permission", children: p }, p))) })), !member.isOwner && member.permissions.length === 0 && (_jsx("span", { className: "badge badge-default", children: "L\u00E4s\u00E5tkomst" }))] }), _jsx("div", { className: "member-meta", children: _jsx("small", { style: { color: "#6b7280" }, children: new Date(member.createdAt).toLocaleDateString("sv-SE") }) })] }, member.id))) })) })] }));
}
