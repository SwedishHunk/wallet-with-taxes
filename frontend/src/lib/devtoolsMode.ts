const STORAGE_KEY = "devtools_mode";

export type DevtoolsMode = "sandbox" | "live-like";

export function getDevtoolsMode(): DevtoolsMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "live-like" ? "live-like" : "sandbox";
  } catch {
    return "sandbox";
  }
}

export function setDevtoolsMode(mode: DevtoolsMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(
      new CustomEvent("devtools:mode-changed", {
        detail: { mode },
      }),
    );
  } catch {
    // ignore restricted storage environments
  }
}
