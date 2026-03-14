/**
 * Route Guards - Tre komponenter för de tre auth-states
 *
 * Redirect Logic (NO LOOPS):
 * ─────────────────────────────────────────────────────
 * ProtectedUnauthenticated:
 *   - Requires: state === Unauthenticated
 *   - Used for: /login, /signup, /create-studio
 *   - Redirect: if authenticated → /dashboard
 *
 * ProtectedStudioAuth:
 *   - Requires: studioSession exists (any member state)
 *   - Used for: /dashboard, /studios (read-only)
 *   - Redirect: if no session → /login
 *
 * ProtectedMemberAuth:
 *   - Requires: studioSession + memberSession
 *   - Used for: /members, /games, /settings (admin)
 *   - Redirect if Unauthenticated → /login
 *   - Redirect if StudioAuthenticated (no member) → /dashboard
 *
 * No circular redirects possible.
 */

import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "./AuthContext";
import { ROUTES } from "../routes";

interface GuardProps {
  children: ReactNode;
}

/**
 * ProtectedUnauthenticated
 * Only for login/signup/create-studio pages
 * If user is already authenticated: redirect to /dashboard
 */
export function ProtectedUnauthenticated({ children }: GuardProps) {
  const { authContext, isLoading } = useAuthState();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // If authenticated (any level), send to dashboard
  if (authContext.state !== "Unauthenticated") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  // Otherwise allow
  return <>{children}</>;
}

/**
 * ProtectedStudioAuth
 * Requires studioSession (reads-only, CTA for member login)
 * Redirects: Unauthenticated → /login
 */
export function ProtectedStudioAuth({ children }: GuardProps) {
  const { authContext, isLoading } = useAuthState();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // No session at all
  if (authContext.state === "Unauthenticated") {
    return <Navigate to={ROUTES.login} replace />;
  }

  // Has studio-session (either StudioAuthenticated or Studio+MemberActive)
  return <>{children}</>;
}

/**
 * ProtectedMemberLogin
 * Only for /member-login page
 * Requires: StudioAuthenticated + membersCount > 1
 * Blocks if: auto-owner is active (membersCount === 1)
 */
export function ProtectedMemberLogin({ children }: GuardProps) {
  const { authContext, isLoading, membersCount } = useAuthState();

  if (isLoading || membersCount === null) {
    return <div>Loading...</div>;
  }

  // If auto-owner active (membersCount === 1), redirect to dashboard
  if (membersCount === 1) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  // If not StudioAuthenticated, redirect to login
  if (authContext.state === "Unauthenticated") {
    return <Navigate to={ROUTES.login} replace />;
  }

  // If already member-authenticated, redirect to dashboard
  if (authContext.state === "Studio+MemberActive") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  // StudioAuthenticated + membersCount > 1: allow member login page
  return <>{children}</>;
}

/**
 * ProtectedMemberAuth
 * Requires BOTH studioSession + memberSession
 * Redirects:
 *   - Unauthenticated → /login
 *   - StudioAuthenticated (no member) → /dashboard (with CTA to select member)
 */
export function ProtectedMemberAuth({ children }: GuardProps) {
  const { authContext, isLoading } = useAuthState();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (authContext.state === "Unauthenticated") {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (authContext.state === "StudioAuthenticated") {
    // Has studio session but no active member
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  // Studio+MemberActive - allowed
  return <>{children}</>;
}

/**
 * ProtectedTriolithAdmin
 * Requires studioSession.isTriolithAdmin === true
 * Regular studio owners are redirected to /dashboard
 */
export function ProtectedTriolithAdmin({ children }: GuardProps) {
  const { authContext, isLoading } = useAuthState();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (authContext.state === "Unauthenticated") {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (authContext.studioSession?.isTriolithAdmin !== true) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}

/**
 * WithAuth - Higher-order component version (if needed)
 *
 * Usage:
 * const ProtectedPage = WithAuth(MyPage, "Studio+MemberActive");
 * <Route path="/members" element={<ProtectedPage />} />
 */
export function WithAuth(
  Component: React.ComponentType<Record<string, unknown>>,
  requiredState:
    | "Unauthenticated"
    | "StudioAuthenticated"
    | "Studio+MemberActive",
) {
  return function ProtectedComponent(props: Record<string, unknown>) {
    const { authContext, isLoading } = useAuthState();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    // Redirect logic baserat på required state
    if (
      requiredState === "Unauthenticated" &&
      authContext.state !== "Unauthenticated"
    ) {
      return <Navigate to={ROUTES.dashboard} replace />;
    }

    if (
      requiredState === "StudioAuthenticated" &&
      authContext.state === "Unauthenticated"
    ) {
      return <Navigate to={ROUTES.login} replace />;
    }

    if (
      requiredState === "Studio+MemberActive" &&
      authContext.state !== "Studio+MemberActive"
    ) {
      return authContext.state === "Unauthenticated" ? (
        <Navigate to={ROUTES.login} replace />
      ) : (
        <Navigate to={ROUTES.dashboard} replace />
      );
    }

    return <Component {...props} />;
  };
}
