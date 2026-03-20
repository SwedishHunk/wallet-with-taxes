/**
 * SessionContext — manages studio + member session persistence.
 *
 * Separated from the old monolithic AuthContext so that game state
 * changes don't re-render every component that only needs session data.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  AuthState,
  StudioSession,
  MemberSession,
} from "../../types/auth";
import { getMemberSession, getMembersCount, logout } from "../users";

const STUDIO_SESSION_KEY = "studio_session";
const MEMBER_SESSION_KEY = "member_session";

// sessionStorage reduces persistence window for XSS session theft
const store = sessionStorage;

// ──────────────────────────────────────────────────────────────
// Migration: move old keys from localStorage → sessionStorage
// ──────────────────────────────────────────────────────────────
function migrateOldKeys() {
  const sources = [localStorage, sessionStorage];
  for (const src of sources) {
    const oldStudio = src.getItem("lia_studio_session");
    const oldMember = src.getItem("lia_member_session");
    if (oldStudio) {
      store.setItem(STUDIO_SESSION_KEY, oldStudio);
      src.removeItem("lia_studio_session");
    }
    if (oldMember) {
      store.setItem(MEMBER_SESSION_KEY, oldMember);
      src.removeItem("lia_member_session");
    }
  }
  const lsStudio = localStorage.getItem(STUDIO_SESSION_KEY);
  const lsMember = localStorage.getItem(MEMBER_SESSION_KEY);
  if (lsStudio) {
    store.setItem(STUDIO_SESSION_KEY, lsStudio);
    localStorage.removeItem(STUDIO_SESSION_KEY);
  }
  if (lsMember) {
    store.setItem(MEMBER_SESSION_KEY, lsMember);
    localStorage.removeItem(MEMBER_SESSION_KEY);
  }
}

// ──────────────────────────────────────────────────────────────
// Context shape
// ──────────────────────────────────────────────────────────────
export interface SessionContextType {
  studioSession: StudioSession | null;
  memberSession: MemberSession | null;
  authState: AuthState;
  isLoading: boolean;
  membersCount: number | null;
  setStudioSession: (session: StudioSession | null) => void;
  setMemberSession: (session: MemberSession | null) => void;
  logoutStudio: () => void;
  logoutMember: () => void;
}

const SessionCtx = createContext<SessionContextType | null>(null);

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: ReactNode }) {
  const [studioSession, setStudioSessionState] = useState<StudioSession | null>(null);
  const [memberSession, setMemberSessionState] = useState<MemberSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membersCount, setMembersCount] = useState<number | null>(null);

  // ── Hydrate from sessionStorage on mount ──────────────────
  useEffect(() => {
    try {
      migrateOldKeys();

      const savedStudio = store.getItem(STUDIO_SESSION_KEY);
      if (savedStudio) {
        try {
          const parsed = JSON.parse(savedStudio);
          if (parsed?.studioId) setStudioSessionState(parsed);
          else store.removeItem(STUDIO_SESSION_KEY);
        } catch {
          store.removeItem(STUDIO_SESSION_KEY);
        }
      }

      const savedMember = store.getItem(MEMBER_SESSION_KEY);
      if (savedMember) {
        try {
          const parsed = JSON.parse(savedMember);
          if (parsed?.memberId && parsed?.studioId) setMemberSessionState(parsed);
          else store.removeItem(MEMBER_SESSION_KEY);
        } catch {
          store.removeItem(MEMBER_SESSION_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load auth sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Load membersCount on hydration ────────────────────────
  useEffect(() => {
    if (isLoading || !studioSession?.studioId || membersCount !== null) return;
    (async () => {
      try {
        const { data } = await getMembersCount(studioSession.studioId);
        setMembersCount(data?.length ?? 0);
      } catch {
        setMembersCount(0);
      }
    })();
  }, [studioSession, membersCount, isLoading]);

  // ── Auto-activate owner if exactly 1 member ──────────────
  useEffect(() => {
    if (isLoading || !studioSession || memberSession || membersCount === null) return;
    if (membersCount === 1) {
      (async () => {
        try {
          const { data } = await getMemberSession(studioSession.studioId);
          setMemberSessionState(data);
          store.setItem(MEMBER_SESSION_KEY, JSON.stringify(data));
        } catch (err) {
          console.warn("[SessionContext] Failed to auto-activate owner:", err);
        }
      })();
    }
  }, [studioSession, memberSession, membersCount, isLoading]);

  // ── Auth state derivation ─────────────────────────────────
  const authState: AuthState = !studioSession
    ? "Unauthenticated"
    : !memberSession
      ? "StudioAuthenticated"
      : "Studio+MemberActive";

  // ── Setters ───────────────────────────────────────────────
  const setStudioSession = (session: StudioSession | null) => {
    if (session) {
      store.setItem(STUDIO_SESSION_KEY, JSON.stringify(session));
      setStudioSessionState(session);
      // Load member count for incoming studio
      (async () => {
        try {
          const { data } = await getMembersCount(session.studioId);
          setMembersCount(data?.length ?? 0);
        } catch {
          setMembersCount(0);
        }
      })();
    } else {
      store.removeItem(STUDIO_SESSION_KEY);
      setStudioSessionState(null);
      setMembersCount(null);
    }
  };

  const setMemberSession = (session: MemberSession | null) => {
    if (session) {
      store.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
      setMemberSessionState(session);
    } else {
      store.removeItem(MEMBER_SESSION_KEY);
      setMemberSessionState(null);
    }
  };

  const logoutStudio = () => {
    setStudioSession(null);
    setMemberSession(null);
    // Best-effort: ask server to clear the HttpOnly cookie.
    void logout().catch(() => undefined);
    window.location.href = "/login";
  };

  const logoutMember = () => {
    setMemberSession(null);
    window.location.href = "/dashboard";
  };

  return (
    <SessionCtx.Provider
      value={{
        studioSession,
        memberSession,
        authState,
        isLoading,
        membersCount,
        setStudioSession,
        setMemberSession,
        logoutStudio,
        logoutMember,
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

// ──────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
