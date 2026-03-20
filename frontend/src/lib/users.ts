import { api } from "./api";
import type { User } from "../types/user";

export const signup = (email: string, password: string, studioName?: string) =>
  api.post("/users/signup", { email, password, studioName });

export const login = (email: string, password: string, studioId?: string) =>
  api.post("/users/login", { email, password, studioId });

/**
 * Exchange the base JWT for a studio-scoped JWT by explicitly selecting a
 * studio. Must be called after login for multi-studio users (or auto-called
 * by the frontend when there is only one studio available).
 */
export const selectStudio = (studioId: string) =>
  api.post<{
    studioId: string;
    studioName: string;
    role: string;
    isTriolithAdmin: boolean;
  }>("/users/select-studio", { studioId });

/** Clear the HttpOnly cookie server-side and end the session. */
export const logout = () => api.post("/users/logout");

export const getStudios = () => api.get("/users/studios");

export const getMemberSession = (studioId: string) =>
  api.get(`/users/member-session/${studioId}`);

export const getMembersCount = (studioId: string) =>
  api.get(`/studios/${studioId}/members`);

export const getStudioMembers = (studioId: string) =>
  api.get(`/studios/${studioId}/members`);

export const createStudioMember = (
  studioId: string,
  payload: { email: string; password?: string; role?: string; permissions: string[] },
) => api.post(`/studios/${studioId}/members`, payload);

export const updateStudioMember = (
  studioId: string,
  memberId: string,
  payload: { role?: string; permissions: string[] },
) => api.patch(`/studios/${studioId}/members/${memberId}`, payload);

export const deleteStudioMember = (studioId: string, memberId: string) =>
  api.delete(`/studios/${studioId}/members/${memberId}`);

export const linkWallet = (email: string, walletAddress: string) =>
  api.post("/users/link-wallet", { email, walletAddress });

export const getMe = () => api.get<User>("/users/me");

export const devBootstrap = (payload?: {
  mode?: "player" | "studio" | "admin";
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}) =>
  api.post("/admin/dev/bootstrap", payload ?? {}, {
    headers: import.meta.env.VITE_DEV_BOOTSTRAP_KEY
      ? {
          "x-dev-bootstrap-key": import.meta.env.VITE_DEV_BOOTSTRAP_KEY,
        }
      : undefined,
  });
