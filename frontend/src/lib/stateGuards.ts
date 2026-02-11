// stateGuards.ts
// Central source of truth for allowed system states

export type SystemState = {
  studioSession: unknown | null;
  memberSession: unknown | null;
  activeGame: unknown | null;
};

export type StateViolation = {
  code: string;
  message: string;
};

export function validateSystemState(state: SystemState): {
  valid: boolean;
  violations: StateViolation[];
} {
  const violations: StateViolation[] = [];

  if (!state.studioSession && state.memberSession) {
    violations.push({
      code: "MEMBER_WITHOUT_STUDIO",
      message: "Member session exists without studio session",
    });
  }

  if (!state.memberSession && state.activeGame) {
    violations.push({
      code: "GAME_WITHOUT_MEMBER",
      message: "Active game exists without member session",
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
