import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useNavigate, Outlet } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { useLogout, useCanManageMembers } from "../lib/useAuth";
import { ROUTES } from "../routes";
import "./AppLayout.css";
export function AppLayout() {
  return _jsxs("div", {
    className: "app-layout",
    children: [
      _jsx(Header, {}),
      _jsx("main", { className: "app-content", children: _jsx(Outlet, {}) }),
      _jsx(Footer, {}),
    ],
  });
}
/**
 * Header - State-driven navigation
 */
function Header() {
  const { authContext, isLoading } = useAuthState();
  const { logoutStudio, logoutMember } = useLogout();
  const navigate = useNavigate();
  if (isLoading) {
    return _jsx("header", {
      className: "app-header",
      children: _jsx("div", { children: "Loading..." }),
    });
  }
  return _jsx("header", {
    className: "app-header",
    children: _jsxs("div", {
      className: "header-container",
      children: [
        _jsx(Link, {
          to: "/",
          className: "header-logo",
          children: "Genesis Wallet",
        }),
        _jsxs("nav", {
          className: "header-nav",
          children: [
            authContext.state === "Unauthenticated" &&
              _jsxs("div", {
                className: "header-actions",
                children: [
                  _jsx(Link, {
                    to: ROUTES.login,
                    className: "btn btn-primary",
                    children: "Login",
                  }),
                  _jsx(Link, {
                    to: ROUTES.createStudio,
                    className: "btn btn-secondary",
                    children: "Sign Up",
                  }),
                ],
              }),
            authContext.state === "StudioAuthenticated" &&
              _jsxs("div", {
                className: "header-actions",
                children: [
                  _jsxs("div", {
                    className: "studio-info",
                    children: [
                      _jsxs("span", {
                        className: "studio-name",
                        children: [
                          "Studio: ",
                          authContext.studioSession?.studioName,
                        ],
                      }),
                      _jsx("span", {
                        className: "status-badge",
                        children: "Studio Only",
                      }),
                    ],
                  }),
                  _jsx("button", {
                    className: "btn btn-outline",
                    onClick: () => navigate(ROUTES.studios),
                    children: "Select Member",
                  }),
                  _jsx("button", {
                    className: "btn btn-danger",
                    onClick: logoutStudio,
                    children: "Logout",
                  }),
                ],
              }),
            authContext.state === "Studio+MemberActive" &&
              _jsxs("div", {
                className: "header-actions",
                children: [
                  _jsxs("div", {
                    className: "member-info",
                    children: [
                      _jsxs("div", {
                        className: "info-item",
                        children: [
                          _jsx("span", {
                            className: "label",
                            children: "Studio:",
                          }),
                          _jsx("span", {
                            className: "value",
                            children: authContext.studioSession?.studioName,
                          }),
                        ],
                      }),
                      _jsxs("div", {
                        className: "info-item",
                        children: [
                          _jsx("span", {
                            className: "label",
                            children: "Member:",
                          }),
                          _jsx("span", {
                            className: "value",
                            children: authContext.memberSession?.email,
                          }),
                        ],
                      }),
                      authContext.memberSession?.isOwner &&
                        _jsx("span", {
                          className: "owner-badge",
                          children: "Owner",
                        }),
                    ],
                  }),
                  _jsx(AdminLinks, {}),
                  _jsxs("div", {
                    className: "logout-buttons",
                    children: [
                      _jsx("button", {
                        className: "btn btn-outline",
                        onClick: logoutMember,
                        title:
                          "Return to studio dashboard (keep studio session)",
                        children: "Back to Studio",
                      }),
                      _jsx("button", {
                        className: "btn btn-danger",
                        onClick: logoutStudio,
                        title: "Complete logout (clear all sessions)",
                        children: "Logout",
                      }),
                    ],
                  }),
                ],
              }),
          ],
        }),
      ],
    }),
  });
}
/**
 * AdminLinks - Only visible when member is active + has permissions
 * Shows buttons based on what the current member can do
 */
function AdminLinks() {
  const { authContext } = useAuthState();
  const canManageMembers = useCanManageMembers();
  const hasManageGames =
    authContext.memberSession?.permissions.includes("ManageGames") ?? false;
  const hasManageSettings =
    authContext.memberSession?.permissions.includes("ManageSettings") ?? false;
  return _jsxs("div", {
    className: "admin-links",
    children: [
      canManageMembers &&
        _jsx(Link, {
          to: ROUTES.members,
          className: "btn btn-sm btn-info",
          children: "Members",
        }),
      hasManageGames &&
        _jsx(Link, {
          to: ROUTES.games,
          className: "btn btn-sm btn-info",
          children: "Games",
        }),
      hasManageSettings &&
        _jsx(Link, {
          to: ROUTES.settings,
          className: "btn btn-sm btn-info",
          children: "Settings",
        }),
      _jsx(Link, {
        to: ROUTES.dashboard,
        className: "btn btn-sm btn-secondary",
        children: "Dashboard",
      }),
    ],
  });
}
/**
 * Footer - Simple footer
 */
function Footer() {
  return _jsx("footer", {
    className: "app-footer",
    children: _jsx("div", {
      className: "footer-content",
      children: _jsx("p", {
        children: "\u00A9 2026 Genesis Wallet. All rights reserved.",
      }),
    }),
  });
}
