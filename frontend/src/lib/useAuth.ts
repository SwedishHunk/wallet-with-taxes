/**
 * useAuth - Custom hooks för common auth-operationer
 *
 * - useAuthState() - redan tillgänglig från AuthContext
 * - useCanManageMembers() - check om medlem kan hantera andra members
 * - useCurrentMember() - get current medlem info
 * - useLoginMember() - save member session
 * - useLoginStudio() - save studio session
 */

import { useAuthState } from "./AuthContext";
import { MemberSession, StudioSession } from "../types/auth";

/**
 * useAuth - Main hook to access current auth state for UI
 * Returns combined auth info with convenience properties
 */
export function useAuth() {
  const { authContext, setStudioSession, setMemberSession } = useAuthState();

  const isAuthenticated = authContext.state !== "Unauthenticated";
  const isStudioAuth =
    authContext.state === "StudioAuthenticated" ||
    authContext.state === "Studio+MemberActive";
  const isMemberAuth = authContext.state === "Studio+MemberActive";

  return {
    authContext,
    studioSession: authContext.studioSession,
    memberSession: authContext.memberSession,
    isAuthenticated,
    isStudioAuth,
    isMemberAuth,
    currentStudio: authContext.studioSession,
    currentMember: authContext.memberSession,
    canManageMembers: useCanManageMembers(),
    canViewDashboard: isStudioAuth,
    setStudioSession,
    setMemberSession,
  };
}

/**
 * useCanManageMembers - Check if current member can manage other members
 *
 * Policy:
 * - Owner kan ALLTID
 * - ManageMembers permission räcker för icke-Owner operations
 *
 * Returns: boolean
 */
export function useCanManageMembers(): boolean {
  const { authContext } = useAuthState();

  if (
    authContext.state !== "Studio+MemberActive" ||
    !authContext.memberSession
  ) {
    return false;
  }

  const member = authContext.memberSession;

  // Owners can always manage members
  if (member.isOwner) {
    return true;
  }

  // Check if has ManageMembers permission (string flag)
  const hasManageMembers = member.permissions.includes("ManageMembers");

  return hasManageMembers;
}

/**
 * useCanPromoteToOwner - Check if current member can promote others to Owner
 *
 * Policy: ONLY Owners can promote
 *
 * Returns: boolean
 */
export function useCanPromoteToOwner(): boolean {
  const { authContext } = useAuthState();

  if (
    authContext.state !== "Studio+MemberActive" ||
    !authContext.memberSession
  ) {
    return false;
  }

  // Only Owners can promote
  return authContext.memberSession.isOwner;
}

/**
 * useHasPermission - Check if current member has a specific permission
 *
 * Usage:
 * const canMintNFT = useHasPermission("MintNFT");
 */
export function useHasPermission(permission: string): boolean {
  const { authContext } = useAuthState();

  if (
    authContext.state !== "Studio+MemberActive" ||
    !authContext.memberSession
  ) {
    return false;
  }

  return authContext.memberSession.permissions.includes(permission);
}

/**
 * useHasGameAccess - Check if current member has access to a specific game
 *
 * Usage:
 * const hasAccess = useHasGameAccess(gameId);
 */
export function useHasGameAccess(gameId: string): boolean {
  const { authContext } = useAuthState();

  if (
    authContext.state !== "Studio+MemberActive" ||
    !authContext.memberSession
  ) {
    return false;
  }

  return authContext.memberSession.gameAccessIds.includes(gameId);
}

/**
 * useCurrentMember - Get current member info
 *
 * Returns: MemberSession | null
 */
export function useCurrentMember(): MemberSession | null {
  const { authContext } = useAuthState();

  if (authContext.state !== "Studio+MemberActive") {
    return null;
  }

  return authContext.memberSession;
}

/**
 * useCurrentStudio - Get current studio info
 *
 * Returns: StudioSession | null
 */
export function useCurrentStudio(): StudioSession | null {
  const { authContext } = useAuthState();

  if (!authContext.studioSession) {
    return null;
  }

  return authContext.studioSession;
}

/**
 * useLoginMember - Save member session after successful login
 *
 * Usage after successful member-login API call:
 * const { loginMember } = useLoginMember();
 * loginMember({
 *   memberId: "...",
 *   userId: "...",
 *   studioId: "...",
 *   email: "...",
 *   isOwner: false,
 *   permissions: { ... },
 *   gameAccessIds: [...],
 *   authenticatedAt: new Date().toISOString(),
 * });
 */
export function useLoginMember() {
  const { setMemberSession } = useAuthState();

  return {
    loginMember: (session: MemberSession) => {
      setMemberSession(session);
    },
  };
}

/**
 * useLoginStudio - Save studio session after successful login
 *
 * Usage after successful studio-login:
 * const { loginStudio } = useLoginStudio();
 * loginStudio({
 *   studioId: "...",
 *   studioName: "...",
 *   authenticatedAt: new Date().toISOString(),
 * });
 */
export function useLoginStudio() {
  const { setStudioSession } = useAuthState();

  return {
    loginStudio: (session: StudioSession) => {
      setStudioSession(session);
    },
  };
}

/**
 * useLogout - Access logout functions
 *
 * Usage:
 * const { logoutStudio, logoutMember } = useLogout();
 *
 * logoutStudio() - clears both sessions, redirects to /login
 * logoutMember() - clears only member session, redirects to /dashboard
 */
export function useLogout() {
  const { logoutStudio, logoutMember } = useAuthState();

  return {
    logoutStudio,
    logoutMember,
  };
}
