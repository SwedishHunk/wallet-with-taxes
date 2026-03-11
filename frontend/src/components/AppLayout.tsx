/**
 * AppLayout - Enhetlig layout för alla sidor
 *
 * Komponenter:
 * - Header - state-styrd navigation + logout
 * - Footer (optional)
 * - Main content area
 *
 * Header visar olika innehål baserat på auth-state:
 * - Unauthenticated: bara logo
 * - StudioAuthenticated: studio-info + "Select Member" + logout-studio
 * - Studio+MemberActive: studio + member info + all admin buttons + logout buttons
 */

import React from "react";
import { Link, NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  Users, Gamepad2, SlidersHorizontal, LayoutDashboard,
  LogOut, LogIn, UserPlus, UserCheck,
} from "lucide-react";
import { useAuthState } from "../lib/AuthContext";
import { useLogout, useCanManageMembers } from "../lib/useAuth";
import { useLanguage } from "../lib/LanguageContext";
import { ROUTES } from "../routes";
import { APP_NAME, APP_SHORT_NAME, APP_YEAR } from "../config/app";
import CyberpunkScene from "./3d/SafeCyberpunkScene";
import FilmGrainOverlay from "./3d/FilmGrainOverlay";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <div className="app-layout">
      <CyberpunkScene intensity="subtle" sacredGeometry="fibonacci" />
      <FilmGrainOverlay />
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Animated neon triangle — shared logo mark */
function TriangleMark() {
  return (
    <div className="logo-triangle-wrap">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="triStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="triStroke2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        {/* 3D depth shadow */}
        <polygon points="17,6 30,28 4,28" stroke="rgba(168,85,247,0.22)" strokeWidth="1.5" transform="translate(1.2,1.2)" />
        {/* Outer triangle */}
        <polygon points="17,6 30,28 4,28" stroke="url(#triStroke)" strokeWidth="2.2" />
        {/* Inner triangle */}
        <polygon points="17,12 25.5,26 8.5,26" stroke="url(#triStroke2)" strokeWidth="1.1" opacity="0.6" />
        {/* Center glow dot */}
        <circle cx="17" cy="21" r="1.6" fill="#00d4ff" opacity="0.85" />
      </svg>
    </div>
  );
}

/**
 * Header - State-driven navigation
 * Layout mirrors player page: Logo | Center nav | Right info+actions
 */
function Header() {
  const { authContext, isLoading, membersCount } = useAuthState();
  const { logoutStudio, logoutMember } = useLogout();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (isLoading) {
    return <header className="app-header"><div className="header-container" /></header>;
  }

  return (
    <header className="app-header">
      <div className="header-container">

        {/* ── Left: Logo ── */}
        <Link to={ROUTES.root} className="header-logo">
          <TriangleMark />
          <span style={{ fontFamily: '"Orbitron", "Inter", sans-serif', letterSpacing: "0.04em" }}>
            {APP_SHORT_NAME}
          </span>
          <span className="header-logo-sub">{t("nav.logoSub")}</span>
        </Link>

        {/* ── Center: Nav links (only when member active) ── */}
        <nav className="header-center-nav">
          {authContext.state === "Studio+MemberActive" && <AdminLinks />}
        </nav>

        {/* ── Right: Auth-state actions ── */}
        <div className="header-right">

          {authContext.state === "Unauthenticated" && (
            <>
              <Link to={ROUTES.login} className="btn btn-primary">
                <LogIn size={15} /> {t("common.login")}
              </Link>
              <Link to={ROUTES.createStudio} className="btn btn-secondary">
                <UserPlus size={15} /> {t("common.signup")}
              </Link>
            </>
          )}

          {authContext.state === "StudioAuthenticated" && membersCount !== null && membersCount > 1 && (
            <>
              <div className="studio-info">
                <span className="studio-name">{authContext.studioSession?.studioName}</span>
                <span className="status-badge">{t("nav.studioOnly")}</span>
              </div>
              <button className="btn btn-outline" onClick={() => navigate(ROUTES.memberLogin)}>
                <UserCheck size={15} /> {t("nav.selectMember")}
              </button>
              <button className="btn-ghost-danger" onClick={logoutStudio} title="Logout">
                <LogOut size={16} />
              </button>
            </>
          )}

          {authContext.state === "Studio+MemberActive" && (
            <>
              {/* Compact info chip */}
              <div className="member-info-compact">
                <span className="label">{t("nav.studioLabel")}:</span>
                <span className="value">{authContext.studioSession?.studioName}</span>
                <span className="divider">·</span>
                <span className="label">{t("nav.memberLabel")}:</span>
                <span className="value">{authContext.memberSession?.email}</span>
                {authContext.memberSession?.isOwner && <span className="owner-badge">{t("common.owner")}</span>}
              </div>
              {/* Logout */}
              <button className="btn-ghost-danger" onClick={logoutStudio} title="Logout">
                <LogOut size={16} />
              </button>
            </>
          )}

        </div>
      </div>
    </header>
  );
}

/**
 * AdminLinks — center nav, styled identical to player page nav links
 */
function AdminLinks() {
  const { authContext } = useAuthState();
  const canManageMembers = useCanManageMembers();
  const { t } = useLanguage();
  const hasManageGames   = authContext.memberSession?.permissions.includes("ManageGames")   ?? false;
  const hasManageSettings = authContext.memberSession?.permissions.includes("ManageSettings") ?? false;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    "nav-link" + (isActive ? " nav-link-active" : "");

  return (
    <div className="admin-links">
      {canManageMembers && (
        <NavLink to={ROUTES.members} className={linkClass}>
          <Users size={15} /> {t("nav.members")}
        </NavLink>
      )}
      {hasManageGames && (
        <NavLink to={ROUTES.games} className={linkClass}>
          <Gamepad2 size={15} /> {t("nav.games")}
        </NavLink>
      )}
      {hasManageSettings && (
        <NavLink to={ROUTES.settings} className={linkClass}>
          <SlidersHorizontal size={15} /> {t("nav.settings")}
        </NavLink>
      )}
      <NavLink to={ROUTES.dashboard} className={linkClass}>
        <LayoutDashboard size={15} /> {t("nav.dashboard")}
      </NavLink>
    </div>
  );
}

/**
 * Footer - Simple footer
 */
function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>
          &copy; {APP_YEAR} {APP_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
