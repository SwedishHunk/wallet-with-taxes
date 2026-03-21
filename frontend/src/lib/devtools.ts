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
