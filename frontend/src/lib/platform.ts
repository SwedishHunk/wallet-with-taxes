import { api } from "./api";

export const createGame = (data: { name: string; slug: string }) =>
  api.post("/platform/games", data);

export const getGames = () => api.get("/platform/games");

export const getGameDetails = (gameId: string) =>
  api.get(`/platform/games/${gameId}`);

export const getGameWallet = (gameId: string) =>
  api.get(`/platform/games/${gameId}/wallet`);

export const depositToWallet = (gameId: string, amount: string) =>
  api.post(`/platform/games/${gameId}/wallet/deposit`, { amount });

export const withdrawFromWallet = (gameId: string, amount: string) =>
  api.post(`/platform/games/${gameId}/wallet/withdraw`, { amount });

// NFT Functions

export const getNFTTemplates = (gameId: string) =>
  api.get(`/platform/games/${gameId}/nft-templates`);

export const createNFTTemplate = (
  gameId: string,
  data: {
    name: string;
    tier?: number;
    attributes?: Record<string, any>;
    upkeepCostPerDay?: string;
    mintingCost?: string;
    maxMintCount?: number;
  },
) => api.post(`/platform/games/${gameId}/nft-templates`, data);

export const getPlayerNFTs = (gameId: string) =>
  api.get(`/platform/games/${gameId}/my-nfts`);

export const mintNFT = (
  gameId: string,
  templateId: string,
  targetUserId?: string,
) =>
  api.post(`/platform/games/${gameId}/nft-templates/${templateId}/mint`, {
    targetUserId,
  });

export const updateNFT = (
  gameId: string,
  nftId: string,
  data: {
    equipped?: boolean;
    condition?: number;
    customAttributes?: Record<string, any>;
  },
) => api.post(`/platform/games/${gameId}/nfts/${nftId}/update`, data);
// Personal Account Management

export const createPersonalAccount = (data: { email: string; password: string; accessPoints?: Record<string, boolean> }) =>
  api.post("/platform/personal-accounts", data);

export const getPersonalAccounts = () =>
  api.get("/platform/personal-accounts");

export const loginPersonalAccount = (data: { email: string; password: string }) =>
  api.post("/platform/personal-accounts/login", data);

export const updatePersonalAccountPermissions = (
  userId: string,
  accessPoints: Record<string, boolean>,
) =>
  api.post(`/platform/personal-accounts/${userId}/permissions`, { accessPoints });
