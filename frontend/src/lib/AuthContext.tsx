/**
 * AuthContext — backward-compatible composition layer.
 *
 * WHAT CHANGED (Fix 11):
 * The original monolithic AuthContext (396 lines) was split into two
 * domain-scoped contexts:
 *   - SessionContext: studio + member session persistence & auth state
 *   - GameContext: active game selection
 *
 * This file now acts as a thin wrapper that:
 *   1. Composes both providers under one <AuthProvider>
 *   2. Re-exports useAuthState() with the same API as before
 *
 * NO CONSUMER CHANGES NEEDED — all 13 files that use useAuthState()
 * continue to work without modification.
 *
 * PERFORMANCE WIN:
 * Components that only need game data (e.g., Games.tsx) can import
 * useGame() directly from GameContext — they won't re-render when
 * session state changes, and vice versa.
 */

import React, { ReactNode } from "react";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { GameProvider, useGame } from "./contexts/GameContext";
import { AuthContext as AuthContextData } from "../types/auth";
import { validateSystemState } from "./stateGuards";

// ──────────────────────────────────────────────────────────────
// Composed Provider
// ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <GameProvider>{children}</GameProvider>
    </SessionProvider>
  );
}

// ──────────────────────────────────────────────────────────────
// Backward-compatible hook
// Returns the exact same shape as the old useAuthState()
// ──────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthState() {
  const session = useSession();
  const game = useGame();

  const authContext: AuthContextData = {
    state: session.authState,
    studioSession: session.studioSession,
    memberSession: session.memberSession,
  };

  // Keep the state validation from the original implementation
  if (!session.isLoading) {
    const validation = validateSystemState({
      studioSession: session.studioSession,
      memberSession: session.memberSession,
      activeGame: game.activeGame,
    });
    if (!validation.valid) {
      console.error("[STATE VIOLATION]", validation.violations, {
        studioSession: session.studioSession,
        memberSession: session.memberSession,
        activeGame: game.activeGame,
      });
    }
  }

  return {
    authContext,
    setStudioSession: session.setStudioSession,
    setMemberSession: session.setMemberSession,
    logoutStudio: session.logoutStudio,
    logoutMember: session.logoutMember,
    isLoading: session.isLoading,
    membersCount: session.membersCount,
    activeGame: game.activeGame,
    setActiveGame: game.setActiveGame,
  };
}
