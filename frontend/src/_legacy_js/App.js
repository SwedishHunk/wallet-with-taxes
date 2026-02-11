import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { setAuthToken } from "./lib/api";
import { AuthProvider } from "./lib/AuthContext";
import { ProtectedUnauthenticated, ProtectedStudioAuth, ProtectedMemberAuth, } from "./lib/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StudioSelector from "./pages/StudioSelector";
import CreateStudio from "./pages/CreateStudio";
import Dashboard from "./pages/dashboard/index_dash";
import Members from "./pages/Members";
import PersonalAccounts from "./pages/PersonalAccounts";
import CreateFirstPersonalAccount from "./pages/CreateFirstPersonalAccount";
import PersonalAccountLogin from "./pages/PersonalAccountLogin";
import { GameControl } from "./pages/GameControl";
import { ROUTES } from "./routes";
import "./index.css";
function NotFound() {
    return (_jsxs("div", { style: { padding: "40px", textAlign: "center", color: "#fff" }, children: [_jsx("h1", { children: "404 - Route not found" }), _jsxs("p", { children: ["Current URL: ", window.location.pathname] }), _jsx("a", { href: "/login", style: { color: "#60a5fa", textDecoration: "underline" }, children: "Go to login" })] }));
}
function AppRoutes() {
    const location = useLocation();
    useEffect(() => {
        console.log("Route render", location.pathname);
    }, [location]);
    return (_jsxs(Routes, { children: [_jsx(Route, { path: ROUTES.root, element: _jsx(Login, {}) }), _jsx(Route, { path: ROUTES.login, element: _jsx(Login, {}) }), _jsx(Route, { path: ROUTES.signup, element: _jsx(ProtectedUnauthenticated, { children: _jsx(Signup, {}) }) }), _jsx(Route, { path: ROUTES.createStudio, element: _jsx(ProtectedUnauthenticated, { children: _jsx(CreateStudio, {}) }) }), _jsxs(Route, { element: _jsx(AppLayout, {}), children: [_jsx(Route, { path: ROUTES.dashboard, element: _jsx(ProtectedStudioAuth, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: ROUTES.studios, element: _jsx(ProtectedStudioAuth, { children: _jsx(StudioSelector, {}) }) }), _jsx(Route, { path: ROUTES.members, element: _jsx(ProtectedMemberAuth, { children: _jsx(Members, {}) }) }), _jsx(Route, { path: ROUTES.games, element: _jsx(ProtectedMemberAuth, { children: _jsx("div", { style: { padding: "24px", color: "#fff" }, children: "TODO: Games page" }) }) }), _jsx(Route, { path: ROUTES.settings, element: _jsx(ProtectedMemberAuth, { children: _jsx("div", { style: { padding: "24px", color: "#fff" }, children: "TODO: Settings page" }) }) }), _jsx(Route, { path: "/home", element: _jsx(Navigate, { to: ROUTES.dashboard, replace: true }) }), _jsx(Route, { path: "/create-first-account", element: _jsx(ProtectedMemberAuth, { children: _jsx(CreateFirstPersonalAccount, {}) }) }), _jsx(Route, { path: "/account-login", element: _jsx(ProtectedMemberAuth, { children: _jsx(PersonalAccountLogin, {}) }) }), _jsx(Route, { path: "/personal-accounts", element: _jsx(ProtectedMemberAuth, { children: _jsx(PersonalAccounts, {}) }) }), _jsx(Route, { path: "/game/:gameId", element: _jsx(ProtectedMemberAuth, { children: _jsx(GameControl, {}) }) })] }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }));
}
function App() {
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token)
            setAuthToken(token);
    }, []);
    return (_jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsx(AppRoutes, {}) }) }));
}
export default App;
