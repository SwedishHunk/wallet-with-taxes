/* eslint-disable @typescript-eslint/no-floating-promises */
import { ForbiddenException } from "@nestjs/common";
import {
  PlatformController,
  ApiPlatformController,
} from "./platform.controller";

function req(user: { id: string; studioId: string; role: string }) {
  return { user } as never;
}

describe("PlatformController", () => {
  let service: Record<string, jest.Mock>;
  let controller: PlatformController;

  beforeEach(() => {
    service = {
      createGameForUser: jest.fn().mockResolvedValue({ ok: true }),
      getGameWalletBalance: jest.fn(),
      getGameWalletLedger: jest.fn(),
      getGameById: jest.fn(),
      getGamesForUser: jest.fn(),
      depositToGameWallet: jest.fn(),
      createWalletDepositIntent: jest.fn(),
      confirmWalletDepositIntent: jest.fn(),
      withdrawFromGameWallet: jest.fn(),
      transferBetweenPlayersInGame: jest.fn(),
      getNFTTemplatesForGame: jest.fn(),
      createNFTTemplate: jest.fn(),
      getPlayerNFTs: jest.fn(),
      mintNFTToPlayer: jest.fn(),
      updateNFTInstance: jest.fn(),
      createPersonalAccount: jest.fn(),
      getStudioUsers: jest.fn(),
      loginStudioUser: jest.fn(),
      updatePersonalAccountPermissions: jest.fn(),
      getGamePlayers: jest.fn(),
      getAllNFTInstancesForGame: jest.fn(),
      registerPlayerByWallet: jest.fn(),
    };
    controller = new PlatformController(service as never);
  });

  it("createGame blocks non-admin role", () => {
    expect(() =>
      controller.createGame(req({ id: "u1", studioId: "s1", role: "member" }), {
        name: "Game",
        slug: "game",
      } as never),
    ).toThrow(ForbiddenException);
  });

  it("createGame delegates for owner/admin", async () => {
    await controller.createGame(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      {
        name: "Game",
        slug: "game",
      } as never,
    );
    expect(service.createGameForUser).toHaveBeenCalledWith(
      "u1",
      "s1",
      expect.objectContaining({ name: "Game", slug: "game" }),
    );
  });

  it("delegates wallet and game read endpoints", () => {
    controller.getGameWallet(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
    );
    controller.getGameWalletLedger(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
    );
    controller.getGameDetails(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
    );
    controller.getGames(req({ id: "u1", studioId: "s1", role: "member" }));

    expect(service.getGameWalletBalance).toHaveBeenCalledWith("g1", "u1", "s1");
    expect(service.getGameWalletLedger).toHaveBeenCalledWith("g1", "u1", "s1");
    expect(service.getGameById).toHaveBeenCalledWith("g1", "u1", "s1");
    expect(service.getGamesForUser).toHaveBeenCalledWith("s1");
  });

  it("delegates wallet mutation endpoints", () => {
    controller.depositToWallet(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      { amount: 10 } as never,
    );
    controller.createDepositIntent(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      { amount: "15" } as never,
    );
    controller.confirmDepositIntent(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      { intentId: "i1", txHash: "0xabc" } as never,
    );
    controller.withdrawFromWallet(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      { amount: 3 } as never,
    );
    controller.transferToPlayer(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      { toUserId: "u2", amount: 2, description: "tip" } as never,
    );

    expect(service.depositToGameWallet).toHaveBeenCalledWith(
      "g1",
      "u1",
      "s1",
      10,
    );
    expect(service.createWalletDepositIntent).toHaveBeenCalledWith(
      "g1",
      "u1",
      "s1",
      "15",
    );
    expect(service.confirmWalletDepositIntent).toHaveBeenCalledWith(
      "g1",
      "u1",
      "s1",
      "i1",
      "0xabc",
    );
    expect(service.withdrawFromGameWallet).toHaveBeenCalledWith(
      "g1",
      "u1",
      "s1",
      3,
    );
    expect(service.transferBetweenPlayersInGame).toHaveBeenCalledWith(
      "g1",
      "u1",
      "u2",
      "s1",
      2,
      "tip",
    );
  });

  it("delegates nft read/update endpoints", () => {
    controller.getNFTTemplates(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
    );
    controller.getPlayerNFTs(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
    );
    controller.updateNFT(
      req({ id: "u1", studioId: "s1", role: "member" }),
      "g1",
      "n1",
      { metadata: { level: 2 } } as never,
    );

    expect(service.getNFTTemplatesForGame).toHaveBeenCalledWith("g1", "s1");
    expect(service.getPlayerNFTs).toHaveBeenCalledWith("g1", "u1", "s1");
    expect(service.updateNFTInstance).toHaveBeenCalledWith(
      "g1",
      "u1",
      "s1",
      "n1",
      expect.any(Object),
    );
  });

  it("blocks nft template and mint for non-admin role", () => {
    expect(() =>
      controller.createNFTTemplate(
        req({ id: "u1", studioId: "s1", role: "member" }),
        "g1",
        { name: "nft" } as never,
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.mintNFT(
        req({ id: "u1", studioId: "s1", role: "member" }),
        "g1",
        "t1",
        {},
      ),
    ).toThrow(ForbiddenException);
  });

  it("delegates nft template creation and mint for owner/admin", () => {
    controller.createNFTTemplate(
      req({ id: "u1", studioId: "s1", role: "admin" }),
      "g1",
      { name: "nft" } as never,
    );
    controller.mintNFT(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      "g1",
      "t1",
      { gamePlayerId: "gp1" },
    );

    expect(service.createNFTTemplate).toHaveBeenCalledWith(
      "g1",
      "s1",
      expect.objectContaining({ name: "nft" }),
    );
    expect(service.mintNFTToPlayer).toHaveBeenCalledWith(
      "g1",
      "s1",
      "t1",
      "gp1",
    );
  });

  it("blocks personal account creation and permission updates for non-owner", () => {
    expect(() =>
      controller.createPersonalAccount(
        req({ id: "u1", studioId: "s1", role: "admin" }),
        { email: "a@b.com", password: "x", accessPoints: [] } as never,
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.updatePersonalAccountPermissions(
        req({ id: "u1", studioId: "s1", role: "admin" }),
        "u2",
        { accessPoints: ["wallet"] } as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("blocks getGamePlayers for non-admin role", () => {
    expect(() =>
      controller.getGamePlayers(
        req({ id: "u1", studioId: "s1", role: "member" }),
        "g1",
      ),
    ).toThrow(ForbiddenException);
  });

  it("delegates getGamePlayers for owner/admin", () => {
    controller.getGamePlayers(
      req({ id: "u1", studioId: "s1", role: "admin" }),
      "g1",
    );
    expect(service.getGamePlayers).toHaveBeenCalledWith("g1", "s1");
  });

  it("blocks getNFTInstances for non-admin role", () => {
    expect(() =>
      controller.getNFTInstances(
        req({ id: "u1", studioId: "s1", role: "member" }),
        "g1",
      ),
    ).toThrow(ForbiddenException);
  });

  it("delegates getNFTInstances for owner/admin", () => {
    controller.getNFTInstances(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      "g1",
    );
    expect(service.getAllNFTInstancesForGame).toHaveBeenCalledWith("g1", "s1");
  });

  it("blocks registerPlayer for non-admin role", () => {
    expect(() =>
      controller.registerPlayer(
        req({ id: "u1", studioId: "s1", role: "member" }),
        "g1",
        { walletAddress: "0xabc" },
      ),
    ).toThrow(ForbiddenException);
  });

  it("delegates registerPlayer for owner/admin", () => {
    controller.registerPlayer(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      "g1",
      { walletAddress: "0xabc" },
    );
    expect(service.registerPlayerByWallet).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      "s1",
    );
  });

  it("delegates personal account endpoints for owner", () => {
    controller.createPersonalAccount(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      { email: "a@b.com", password: "x", accessPoints: ["wallet"] } as never,
    );
    controller.getPersonalAccounts(
      req({ id: "u1", studioId: "s1", role: "owner" }),
    );
    controller.loginPersonalAccount(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      { email: "a@b.com", password: "x" } as never,
    );
    controller.updatePersonalAccountPermissions(
      req({ id: "u1", studioId: "s1", role: "owner" }),
      "u2",
      { accessPoints: ["reports"] } as never,
    );

    expect(service.createPersonalAccount).toHaveBeenCalledWith(
      "s1",
      "a@b.com",
      "x",
      ["wallet"],
    );
    expect(service.getStudioUsers).toHaveBeenCalledWith("s1");
    expect(service.loginStudioUser).toHaveBeenCalledWith("s1", "a@b.com", "x");
    expect(service.updatePersonalAccountPermissions).toHaveBeenCalledWith(
      "s1",
      "u2",
      ["reports"],
    );
  });
});

describe("ApiPlatformController", () => {
  let apiSvc: Record<string, jest.Mock>;
  let walletAuth: { verifySignedRequest: jest.Mock };
  let apiController: ApiPlatformController;

  beforeEach(() => {
    apiSvc = {
      getPublicGameList: jest.fn().mockReturnValue([]),
      getAllNFTsForWallet: jest.fn(),
      getPlayerGameWallet: jest.fn(),
      playerWithdrawFromGameWallet: jest.fn(),
      playerTransferBetweenPlayers: jest.fn(),
      playerTransferNFT: jest.fn(),
      getNFTShopTemplates: jest.fn(),
      purchaseNFTFromShop: jest.fn(),
      getGameListings: jest.fn().mockReturnValue([]),
      createNFTListing: jest.fn(),
      cancelNFTListing: jest.fn(),
      purchaseNFTListing: jest.fn(),
    };
    walletAuth = {
      verifySignedRequest: jest.fn().mockResolvedValue(undefined),
    };
    apiController = new ApiPlatformController(
      apiSvc as never,
      walletAuth as never,
    );
  });

  it("getPublicGames delegates to getPublicGameList", () => {
    apiController.getPublicGames();
    expect(apiSvc.getPublicGameList).toHaveBeenCalled();
  });

  it("getPlayerNFTs returns [] when address is missing", () => {
    const result = apiController.getPlayerNFTs(undefined as never);
    expect(result).toEqual([]);
    expect(apiSvc.getAllNFTsForWallet).not.toHaveBeenCalled();
  });

  it("getPlayerNFTs delegates to getAllNFTsForWallet", () => {
    apiController.getPlayerNFTs("0xabc");
    expect(apiSvc.getAllNFTsForWallet).toHaveBeenCalledWith("0xabc");
  });

  it("getPlayerWallet returns null when gameId or address missing", () => {
    const result = apiController.getPlayerWallet("", "");
    expect(result).toBeNull();
    expect(apiSvc.getPlayerGameWallet).not.toHaveBeenCalled();
  });

  it("getPlayerWallet delegates to getPlayerGameWallet", () => {
    apiController.getPlayerWallet("g1", "0xabc");
    expect(apiSvc.getPlayerGameWallet).toHaveBeenCalledWith("g1", "0xabc");
  });

  it("playerWithdraw verifies signature and delegates", async () => {
    await apiController.playerWithdraw({
      gameId: "g1",
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
      amount: 5,
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.playerWithdrawFromGameWallet).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      5,
    );
  });

  it("playerTransfer verifies signature and delegates", async () => {
    await apiController.playerTransfer({
      gameId: "g1",
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
      toWalletAddress: "0xdef",
      amount: 3,
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action" }),
    );
    expect(apiSvc.playerTransferBetweenPlayers).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      "0xdef",
      3,
    );
  });

  it("playerNFTTransfer verifies signature and delegates", async () => {
    await apiController.playerNFTTransfer({
      gameId: "g1",
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
      toWalletAddress: "0xdef",
      nftInstanceId: "nft1",
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.playerTransferNFT).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      "0xdef",
      "nft1",
    );
  });

  it("getNFTShop delegates to getNFTShopTemplates", () => {
    apiController.getNFTShop("g1");
    expect(apiSvc.getNFTShopTemplates).toHaveBeenCalledWith("g1");
  });

  it("purchaseNFT verifies signature and delegates", async () => {
    await apiController.purchaseNFT("g1", "t1", {
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.purchaseNFTFromShop).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      "t1",
    );
  });

  it("getMarketplaceListings delegates to getGameListings", () => {
    apiController.getMarketplaceListings("g1");
    expect(apiSvc.getGameListings).toHaveBeenCalledWith("g1");
  });

  it("createMarketplaceListing verifies signature and delegates", async () => {
    await apiController.createMarketplaceListing("g1", {
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
      nftInstanceId: "nft1",
      askPrice: "50",
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.createNFTListing).toHaveBeenCalledWith(
      "g1",
      "0xabc",
      "nft1",
      "50",
    );
  });

  it("cancelMarketplaceListing verifies signature and delegates", async () => {
    await apiController.cancelMarketplaceListing("g1", "l1", {
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.cancelNFTListing).toHaveBeenCalledWith("g1", "0xabc", "l1");
  });

  it("purchaseMarketplaceListing verifies signature and delegates", async () => {
    await apiController.purchaseMarketplaceListing("g1", "l1", {
      walletAddress: "0xabc",
      nonce: "n",
      signature: "s",
    });
    expect(walletAuth.verifySignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "player_action", gameId: "g1" }),
    );
    expect(apiSvc.purchaseNFTListing).toHaveBeenCalledWith("g1", "0xabc", "l1");
  });
});
