import { api } from "./api";

const devHeaders = import.meta.env.VITE_DEV_BOOTSTRAP_KEY
  ? {
      "x-dev-bootstrap-key": import.meta.env.VITE_DEV_BOOTSTRAP_KEY,
    }
  : undefined;

export const devSeedMembers = (payload: { studioId: string; count?: number }) =>
  api.post("/admin/dev/seed-members", payload, {
    headers: devHeaders,
  });

export const devClearSeedMembers = (payload: { studioId: string }) =>
  api.post("/admin/dev/clear-seed-members", payload, {
    headers: devHeaders,
  });

export const devSeedGames = (payload: { studioId: string; count?: number }) =>
  api.post("/admin/dev/seed-games", payload, {
    headers: devHeaders,
  });

export const devClearSeedGames = (payload: { studioId: string }) =>
  api.post("/admin/dev/clear-seed-games", payload, {
    headers: devHeaders,
  });

export const devSeedEconomics = (payload: {
  studioId: string;
  gameId?: string;
  count?: number;
}) =>
  api.post("/admin/dev/seed-economics", payload, {
    headers: devHeaders,
  });

export const devClearSeedEconomics = (payload: {
  studioId: string;
  gameId?: string;
}) =>
  api.post("/admin/dev/clear-seed-economics", payload, {
    headers: devHeaders,
  });

const withReturnToken = (returnToken?: string) => ({
  ...(devHeaders ?? {}),
  ...(returnToken
    ? {
        "x-admin-return-token": returnToken,
      }
    : {}),
});

export type SessionSwitchTarget = {
  id: string;
  userId: string;
  email: string;
  isOwner: boolean;
  role: "owner" | "admin" | "member";
  permissions: string[];
};

export type SessionSwitchStudio = {
  id: string;
  name: string;
  status: string;
  members: SessionSwitchTarget[];
};

export type SessionTargetsResponse = {
  returnToken: string;
  admin: {
    userId: string;
    email: string | null;
    studioId: string | null;
  };
  studios: SessionSwitchStudio[];
};

export type SessionSwitchResponse = {
  returnToken: string;
  studio: {
    studioId: string;
    studioName: string;
    isTriolithAdmin: boolean;
  };
  member: {
    memberId: string;
    userId: string;
    studioId: string;
    email: string;
    isOwner: boolean;
    role: "owner" | "admin" | "member";
    permissions: string[];
    gameAccessIds: string[];
    authenticatedAt: string;
  };
  impersonation: {
    active: boolean;
    targetMemberId?: string;
    targetUserId?: string;
    targetEmail?: string;
    targetStudioId?: string;
    targetStudioName?: string;
    targetRole?: "owner" | "admin" | "member";
    isOwner?: boolean;
  };
};

export const devGetSessionTargets = (returnToken?: string) =>
  api.get<SessionTargetsResponse>("/admin/dev/session-targets", {
    headers: withReturnToken(returnToken),
  });

export const devSwitchSession = (
  payload: { studioId: string; memberId?: string },
  returnToken?: string,
) =>
  api.post<SessionSwitchResponse>("/admin/dev/switch-session", payload, {
    headers: withReturnToken(returnToken),
  });

export const devRestoreSession = (returnToken?: string) =>
  api.post<SessionSwitchResponse>(
    "/admin/dev/restore-session",
    { returnToken },
    {
      headers: withReturnToken(returnToken),
    },
  );

export type DevSystemStateResponse = {
  mode: string;
  totals: {
    users: number;
    studios: number;
    members: number;
    games: number;
    transactions: number;
    taxEvents: number;
    economicEvents: number;
    listings: number;
    nftInstances: number;
  };
  sandbox: {
    members: number;
    games: number;
    economicEvents: number;
  };
};

export const devGetSystemState = () =>
  api.get<DevSystemStateResponse>("/admin/dev/system-state", {
    headers: devHeaders,
  });

export const devClearSandboxData = () =>
  api.post(
    "/admin/dev/clear-sandbox-data",
    {},
    {
      headers: devHeaders,
    },
  );

export const devFullLocalReset = (confirmPhrase: string) =>
  api.post(
    "/admin/dev/full-local-reset",
    { confirmPhrase },
    {
      headers: devHeaders,
    },
  );
