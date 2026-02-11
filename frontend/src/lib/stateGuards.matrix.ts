import { validateSystemState } from "./stateGuards";

const scenarios = [
  {
    name: "No studio",
    state: { studioSession: null, memberSession: null, activeGame: null },
    valid: true,
  },
  {
    name: "Studio only",
    state: { studioSession: {}, memberSession: null, activeGame: null },
    valid: true,
  },
  {
    name: "Member without studio",
    state: { studioSession: null, memberSession: {}, activeGame: null },
    valid: false,
  },
  {
    name: "Game without member",
    state: { studioSession: {}, memberSession: null, activeGame: {} },
    valid: false,
  },
];

for (const s of scenarios) {
  const result = validateSystemState(s.state);
  if (result.valid !== s.valid) {
    console.error("❌ FAILED", s.name, result.violations);
  } else {
    console.log("✅ OK", s.name);
  }
}
