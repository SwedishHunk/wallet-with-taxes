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

export const linkWallet = (email: string, walletAddress: string) =>
  api.post("/users/link-wallet", { email, walletAddress });

export const getMe = () => api.get<User>("/users/me");
