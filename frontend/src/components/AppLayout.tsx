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
import { Link, useNavigate, Outlet } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { useLogout, useCanManageMembers } from "../lib/useAuth";
import { ROUTES } from "../routes";
import { APP_NAME, APP_SHORT_NAME, APP_YEAR } from "../config/app";
import CyberpunkScene from "./3d/SafeCyberpunkScene";
import FilmGrainOverlay from "./3d/FilmGrainOverlay";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <div className="app-layout">
      <CyberpunkScene intensity="subtle" />
      <FilmGrainOverlay />
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/**
 * Header - State-driven navigation
 */
function Header() {
  const { authContext, isLoading, membersCount } = useAuthState();
  const { logoutStudio, logoutMember } = useLogout();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <header className="app-header">
        <div>Loading...</div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo */}
        <Link to={ROUTES.root} className="header-logo">
          {APP_SHORT_NAME}
        </Link>

        {/* State-specific navigation */}
        <nav className="header-nav">
          {authContext.state === "Unauthenticated" && (
            <div className="header-actions">
              <Link to={ROUTES.login} className="btn btn-primary">
                Login
              </Link>
              <Link to={ROUTES.createStudio} className="btn btn-secondary">
                Sign Up
              </Link>
            </div>
          )}

          {authContext.state === "StudioAuthenticated" &&
            membersCount !== null &&
            membersCount > 1 && (
              <div className="header-actions">
                <div className="studio-info">
                  <span className="studio-name">
                    Studio: {authContext.studioSession?.studioName}
                  </span>
                  <span className="status-badge">Studio Only</span>
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(ROUTES.memberLogin)}>
                  Select Member
                </button>
                <button
                  className="btn btn-danger"
                  onClick={logoutStudio}
                  title="Logout and return to login page">
                  Logout
                </button>
              </div>
            )}

          {authContext.state === "Studio+MemberActive" && (
            <div className="header-actions">
              {/* Studio + Member Info */}
              <div className="member-info">
                <div className="info-item">
                  <span className="label">Studio:</span>
                  <span className="value">
                    {authContext.studioSession?.studioName}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Member:</span>
                  <span className="value">
                    {authContext.memberSession?.email}
                  </span>
                </div>
                {authContext.memberSession?.isOwner && (
                  <span className="owner-badge">Owner</span>
                )}
              </div>

              {/* Admin Links - Only if has permissions */}
              <AdminLinks />

              {/* Logout Buttons */}
              <div className="logout-buttons">
                <button
                  className="btn btn-outline"
                  onClick={logoutMember}
                  title="Back to studio (logout as member only)">
                  Back to Studio
                </button>
                <button
                  className="btn btn-danger"
                  onClick={logoutStudio}
                  title="Complete logout (clear studio and member sessions)">
                  Logout Completely
                </button>
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
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

  return (
    <div className="admin-links">
      {/* Members - Only if has ManageMembers permission or is Owner */}
      {canManageMembers && (
        <Link to={ROUTES.members} className="btn btn-sm btn-info">
          Members
        </Link>
      )}

      {/* Games - Only if has ManageGames permission */}
      {hasManageGames && (
        <Link to={ROUTES.games} className="btn btn-sm btn-info">
          Games
        </Link>
      )}

      {/* Settings - Only if has ManageSettings permission */}
      {hasManageSettings && (
        <Link to={ROUTES.settings} className="btn btn-sm btn-info">
          Settings
        </Link>
      )}

      {/* Dashboard - Always accessible */}
      <Link to={ROUTES.dashboard} className="btn btn-sm btn-secondary">
        Dashboard
      </Link>
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
