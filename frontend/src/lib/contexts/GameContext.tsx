/**
 * GameContext — manages which game is currently active.
 *
 * Separated from AuthContext so that session changes (login/logout)
 * don't re-render components that only consume game state.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSession } from "./SessionContext";

const ACTIVE_GAME_KEY = "activeGame";
const store = sessionStorage;

export interface ActiveGame {
  gameId: string;
  name: string;
  slug: string;
}

export interface GameContextType {
  activeGame: ActiveGame | null;
  setActiveGame: (game: ActiveGame | null) => void;
}

const GameCtx = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { studioSession, isLoading } = useSession();
  const [activeGame, setActiveGameState] = useState<ActiveGame | null>(() => {
    // Hydrate synchronously so the first render already has the correct game.
    const saved = store.getItem(ACTIVE_GAME_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.gameId && parsed?.name && parsed?.slug) return parsed;
    } catch { /* noop */ }
    store.removeItem(ACTIVE_GAME_KEY);
    return null;
  });

  // Clear game when studio logs out — but not during initial hydration
  useEffect(() => {
    if (isLoading) return; // wait for SessionContext to finish loading
    if (!studioSession) {
      store.removeItem(ACTIVE_GAME_KEY);
      setActiveGameState(null);
    }
  }, [studioSession, isLoading]);

  const setActiveGame = (game: ActiveGame | null) => {
    if (game) {
      store.setItem(ACTIVE_GAME_KEY, JSON.stringify(game));
      setActiveGameState(game);
    } else {
      store.removeItem(ACTIVE_GAME_KEY);
      setActiveGameState(null);
    }
  };

  return (
    <GameCtx.Provider value={{ activeGame, setActiveGame }}>
      {children}
    </GameCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
