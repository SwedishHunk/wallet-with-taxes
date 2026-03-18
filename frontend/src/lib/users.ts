import { api } from "./api";
import type { User } from "../types/user";

export const signup = (email: string, password: string, studioName?: string) =>
  api.post("/users/signup", { email, password, studioName });

export const login = (email: string, password: string, studioId?: string) =>
  api.post("/users/login", { email, password, studioId });

export const getStudios = () => api.get("/users/studios");

export const getMemberSession = (studioId: string) =>
  api.get(`/users/member-session/${studioId}`);

export const getMembersCount = (studioId: string) =>
  api.get(`/studios/${studioId}/members`);

export const getStudioMembers = (studioId: string) =>
  api.get(`/studios/${studioId}/members`);

export const linkWallet = (
  walletAddress: string,
  currentPassword: string,
  signature: string,
) => api.post("/users/link-wallet", { walletAddress, currentPassword, signature });

export const getMe = () => api.get<User>("/users/me");

export const devBootstrap = (payload?: {
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
