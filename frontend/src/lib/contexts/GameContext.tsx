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
  const { studioSession } = useSession();
  const [activeGame, setActiveGameState] = useState<ActiveGame | null>(null);

  // Hydrate game from sessionStorage
  useEffect(() => {
    const saved = store.getItem(ACTIVE_GAME_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.gameId && parsed?.name && parsed?.slug) {
          setActiveGameState(parsed);
        } else {
          store.removeItem(ACTIVE_GAME_KEY);
        }
      } catch {
        store.removeItem(ACTIVE_GAME_KEY);
      }
    }
  }, []);

  // Clear game when studio changes (new studio = different games)
  useEffect(() => {
    // If there's no studio session anymore, clear the game
    if (!studioSession) {
      store.removeItem(ACTIVE_GAME_KEY);
      setActiveGameState(null);
    }
  }, [studioSession]);

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

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
