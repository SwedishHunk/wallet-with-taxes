type DevToolsTargetsState = {
  studioId?: string;
  memberId?: string;
  gameId?: string;
};

const STORAGE_KEY = "devtools_targets_state";

export function readDevToolsTargets(): DevToolsTargetsState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DevToolsTargetsState;
    return {
      studioId: parsed?.studioId || undefined,
      memberId: parsed?.memberId || undefined,
      gameId: parsed?.gameId || undefined,
    };
  } catch {
    return {};
  }
}

export function writeDevToolsTargets(nextState: DevToolsTargetsState) {
  const normalized: DevToolsTargetsState = {
    studioId: nextState.studioId || undefined,
    memberId: nextState.memberId || undefined,
    gameId: nextState.gameId || undefined,
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent("devtools:targets:change", {
      detail: normalized,
    }),
  );
}
