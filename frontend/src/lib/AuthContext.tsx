/**
 * AuthContext - Global auth state management
 *
 * Två nivåer av sessioner:
 * 1. StudioSession - studio-nivå auth (sparas i localStorage)
 * 2. MemberSession - medlem-nivå auth (sparas i localStorage)
 *
 * States:
 * - Unauthenticated: ingen studio-session
 * - StudioAuthenticated: studio-session, men ingen member-session
 * - Studio+MemberActive: både studio- och member-session aktiva
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  AuthContext as AuthContextData,
  AuthState,
  StudioSession,
  MemberSession,
} from "../types/auth";
import { setAuthToken } from "./api";
import { getMemberSession, getMembersCount } from "./users";

const STUDIO_SESSION_KEY = "studio_session";
const MEMBER_SESSION_KEY = "member_session";

// Migration: Move old keys to new ones
function migrateOldKeys() {
  const oldStudio = localStorage.getItem("lia_studio_session");
  const oldMember = localStorage.getItem("lia_member_session");
  if (oldStudio) {
    localStorage.setItem(STUDIO_SESSION_KEY, oldStudio);
    localStorage.removeItem("lia_studio_session");
    console.log("[AuthContext] Migrated lia_studio_session → studio_session");
  }
  if (oldMember) {
    localStorage.setItem(MEMBER_SESSION_KEY, oldMember);
    localStorage.removeItem("lia_member_session");
    console.log("[AuthContext] Migrated lia_member_session → member_session");
  }
}

interface AuthContextType {
  authContext: AuthContextData;
  setStudioSession: (session: StudioSession | null) => void;
  setMemberSession: (session: MemberSession | null) => void;
  logoutStudio: () => void; // Clear both studio + member
  logoutMember: () => void; // Clear only member
  isLoading: boolean;
  membersCount: number | null; // Total members in current studio
}

const AuthContextDefault: AuthContextType = {
  authContext: {
    state: "Unauthenticated",
    studioSession: null,
    memberSession: null,
  },
  setStudioSession: () => {},
  setMemberSession: () => {},
  logoutStudio: () => {},
  logoutMember: () => {},
  isLoading: true,
  membersCount: null,
};

const AuthContext = createContext<AuthContextType>(AuthContextDefault);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - wraps app with auth state management
 *
 * Features:
 * - Persists studio + member sessions to localStorage
 * - Hydrates on mount
 * - Auto-calculates auth state based on sessions
 * - Provides logout helpers
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [studioSession, setStudioSessionState] = useState<StudioSession | null>(
    null,
  );
  const [memberSession, setMemberSessionState] = useState<MemberSession | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [membersCount, setMembersCount] = useState<number | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      // Migrate old keys first
      migrateOldKeys();

      const savedStudio = localStorage.getItem(STUDIO_SESSION_KEY);
      const savedMember = localStorage.getItem(MEMBER_SESSION_KEY);

      if (savedStudio) {
        const parsedStudio = JSON.parse(savedStudio);
        if (parsedStudio?.studioId) {
          setStudioSessionState(parsedStudio);
        } else {
          localStorage.removeItem(STUDIO_SESSION_KEY);
        }
      }

      if (savedMember) {
        const parsedMember = JSON.parse(savedMember);
        if (parsedMember?.memberId && parsedMember?.studioId) {
          setMemberSessionState(parsedMember);
        } else {
          localStorage.removeItem(MEMBER_SESSION_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load auth sessions from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate auth state based on sessions
  const getAuthState = (): AuthState => {
    if (!studioSession) {
      return "Unauthenticated";
    }
    if (!memberSession) {
      return "StudioAuthenticated";
    }
    return "Studio+MemberActive";
  };

  const currentState = getAuthState();

  // Debug log
  useEffect(() => {
    console.log("[AuthContext] State changed:", currentState, {
      hasStudio: !!studioSession,
      hasMember: !!memberSession,
      isLoading,
      membersCount,
    });
  }, [currentState, studioSession, memberSession, isLoading, membersCount]);

  // Ensure membersCount is loaded even when studioSession is hydrated from localStorage
  useEffect(() => {
    if (isLoading) return;
    if (!studioSession || !studioSession.studioId) return;
    if (membersCount !== null) return;

    console.log("[AuthContext] Loading membersCount for studio:", {
      studioId: studioSession.studioId,
      studioName: studioSession.studioName,
    });

    (async () => {
      try {
        const { data } = await getMembersCount(studioSession.studioId);
        const count = data?.length ?? 0;
        console.log(`[AuthContext] Hydration loaded membersCount: ${count}`);
        setMembersCount(count);
      } catch (err) {
        console.warn(
          "[AuthContext] Failed to load members count on hydration:",
          err,
        );
        setMembersCount(0);
      }
    })();
  }, [studioSession, membersCount, isLoading]);

  // Auto-activate owner if studio is authenticated, no member active, and exactly 1 member exists
  useEffect(() => {
    if (isLoading || !studioSession || memberSession || membersCount === null) {
      return;
    }

    // Only auto-activate if exactly 1 member exists
    if (membersCount === 1) {
      console.log("[AuthContext] Auto-activating owner (membersCount === 1)");
      (async () => {
        try {
          const { data } = await getMemberSession(studioSession.studioId);
          setMemberSessionState(data);
          localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(data));
          console.log("[AuthContext] Owner auto-activated");
        } catch (err) {
          console.warn("[AuthContext] Failed to auto-activate owner:", err);
        }
      })();
    }
  }, [studioSession, memberSession, membersCount, isLoading]);

  // Persist studio session to localStorage AND load members count
  const setStudioSession = (session: StudioSession | null) => {
    if (session) {
      localStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify(session));
      setStudioSessionState(session);

      // Load members count for auto-owner logic
      (async () => {
        try {
          const { data } = await getMembersCount(session.studioId);
          const count = data?.length ?? 0;
          console.log(
            `[AuthContext] Loaded membersCount: ${count} for studio ${session.studioId}`,
          );
          setMembersCount(count);
        } catch (err) {
          console.warn("[AuthContext] Failed to load members count:", err);
          setMembersCount(0);
        }
      })();
    } else {
      localStorage.removeItem(STUDIO_SESSION_KEY);
      setStudioSessionState(null);
      setMembersCount(null); // Reset count when studio is cleared
    }
  };

  // Persist member session to localStorage
  const setMemberSession = (session: MemberSession | null) => {
    console.log("[AuthContext] setMemberSession:", session);
    if (session) {
      localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
      setMemberSessionState(session);
    } else {
      localStorage.removeItem(MEMBER_SESSION_KEY);
      setMemberSessionState(null);
    }
  };

  // Log out studio (clears both studio + member sessions)
  // Redirects to /login
  const logoutStudio = () => {
    setStudioSession(null);
    setMemberSession(null);
    localStorage.removeItem("token");
    setAuthToken(null);
    window.location.href = "/login";
  };

  // Log out member (clears only member session)
  // Keeps studio session and token, redirects to /dashboard (studio read-only view)
  const logoutMember = () => {
    setMemberSession(null);
    // Keep token + studioSession intact
    window.location.href = "/dashboard";
  };

  const authContext: AuthContextData = {
    state: currentState,
    studioSession,
    memberSession,
  };

  const value: AuthContextType = {
    authContext,
    setStudioSession,
    setMemberSession,
    logoutStudio,
    logoutMember,
    isLoading,
    membersCount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuthState - hook to access auth state + actions
 *
 * Usage:
 * const { authContext, setMemberSession, logoutStudio } = useAuthState();
 *
 * if (authContext.state === "Unauthenticated") {
 *   return <Navigate to="/login" />;
 * }
 */
export function useAuthState() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthState must be used inside AuthProvider");
  }

  return context;
}
