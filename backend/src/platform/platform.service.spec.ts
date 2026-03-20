/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { QueryFailedError } from "typeorm";
import { PlatformService } from "./platform.service";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { WalletDepositIntentStatus } from "./entities/wallet-deposit-intent.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { WalletDepositIntent } from "./entities/wallet-deposit-intent.entity";
import { User } from "../users/user.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { MarketplaceListing } from "./entities/marketplace-listing.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";
import { MarketplaceService } from "./marketplace.service";
import { PlayerWalletOperationsService } from "./player-wallet-operations.service";
import { NFTShopService } from "./nft-shop.service";

type Repo = {
  findOne: jest.Mock;
  findOneBy?: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder?: jest.Mock;
};

describe("PlatformService", () => {
  let dataSource: { transaction: jest.Mock };
  let studioRepo: Repo;
  let studioMemberRepo: Repo;
  let gameRepo: Repo;
  let gamePlayerRepo: Repo;
  let walletRepo: Repo;
  let ledgerRepo: Repo;
  let nftTemplateRepo: Repo;
  let nftInstanceRepo: Repo;
  let walletDepositIntentRepo: Repo;
  let userRepo: Repo;
  let walletIdentityRepo: Repo;
  let marketplaceListingRepo: Repo;
  let economicsService: { logEvent: jest.Mock };
  let playerWalletIdentityService: PlayerWalletIdentityService;
  let marketplaceService: MarketplaceService;
  let playerWalletOperationsService: PlayerWalletOperationsService;
  let nftShopService: NFTShopService;
  let service: PlatformService;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(),
    };
    studioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    studioMemberRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    gameRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    gamePlayerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    walletRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    ledgerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    nftTemplateRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    nftInstanceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    walletDepositIntentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    walletIdentityRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    marketplaceListingRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };

    economicsService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };
    playerWalletIdentityService = new PlayerWalletIdentityService(
      gameRepo as never,
      gamePlayerRepo as never,
      walletRepo as never,
      walletIdentityRepo as never,
    );
    marketplaceService = new MarketplaceService(
      dataSource as never,
      gameRepo as never,
      walletRepo as never,
      ledgerRepo as never,
      nftInstanceRepo as never,
      marketplaceListingRepo as never,
      playerWalletIdentityService as never,
    );
    playerWalletOperationsService = new PlayerWalletOperationsService(
      dataSource as never,
      walletRepo as never,
      ledgerRepo as never,
      nftInstanceRepo as never,
      playerWalletIdentityService as never,
    );
    nftShopService = new NFTShopService(
      dataSource as never,
      gameRepo as never,
      walletRepo as never,
      ledgerRepo as never,
      nftInstanceRepo as never,
      nftTemplateRepo as never,
      playerWalletIdentityService as never,
    );

    service = new PlatformService(
      dataSource as never,
      studioRepo as never,
      studioMemberRepo as never,
      gameRepo as never,
      gamePlayerRepo as never,
      walletRepo as never,
      ledgerRepo as never,
      nftTemplateRepo as never,
      nftInstanceRepo as never,
      walletDepositIntentRepo as never,
      userRepo as never,
      walletIdentityRepo as never,
      marketplaceListingRepo as never,
      economicsService as never,
      playerWalletIdentityService as never,
      marketplaceService as never,
      playerWalletOperationsService as never,
      nftShopService as never,
    );

    (jest.spyOn(service as any, "verifyNativeDepositTransaction") as any)
      .mockResolvedValue(undefined);
  });

  it("createWalletDepositIntent creates pending intent with deterministic fake address", async () => {
    gameRepo.findOne.mockResolvedValueOnce({
      id: "g1",
      studio: { id: "s1" },
    });
    userRepo.findOne.mockResolvedValueOnce({ id: "u1" });
    walletDepositIntentRepo.create.mockImplementationOnce((x) => ({
      ...x,
      id: x.id,
    }));

    const result = await service.createWalletDepositIntent(
      "g1",
      "u1",
      "s1",
      "10.5",
    );

    expect(result.amount).toBe("10.5");
    expect(result.depositAddress).toMatch(/^0x[a-f0-9]{40}$/);
    expect(typeof result.expiresAt).toBe("string");
    expect(walletDepositIntentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "10.5",
        status: WalletDepositIntentStatus.PENDING,
      }),
    );
  });

  it("confirmWalletDepositIntent rejects invalid tx hash", async () => {
    await expect(
      service.confirmWalletDepositIntent("g1", "u1", "s1", "i1", "abc"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid txHash",
    });
  });

  it("confirmWalletDepositIntent maps txHash unique violation to AppException", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const qf = new QueryFailedError("INSERT", [], new Error("duplicate"));
    (
      qf as QueryFailedError & {
        driverError?: Error & { code?: string; constraint?: string };
      }
    ).driverError = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "uq_wallet_deposit_intents_tx_hash_not_null",
    });
    dataSource.transaction.mockRejectedValueOnce(qf);

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "txHash already used",
    });
  });

  it("confirmWalletDepositIntent throws when intent has expired", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    dataSource.transaction.mockResolvedValueOnce({ expired: true });

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Deposit intent has expired",
    });
  });

  it("confirmWalletDepositIntent returns wallet on replay of confirmed intent", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });

    const existingWallet = {
      id: "w1",
      balance: "3",
      totalDeposited: "3",
      totalWithdrawn: "0",
    };
    const txIntentRepo = {
      findOne: jest.fn(async () => ({
        id: "i1",
        amount: "2",
        status: WalletDepositIntentStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 60000),
        txHash: "0xabcdef1234",
      })),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest.fn(async () => existingWallet),
      save: jest.fn(async (x) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const result = await service.confirmWalletDepositIntent(
      "g1",
      "u1",
      "s1",
      "i1",
      "0xabcdef1234",
      "idem-confirm-1",
    );

    expect((result as { id: string }).id).toBe("w1");
    expect(txLedgerRepo.save).not.toHaveBeenCalled();
  });

  it("depositToGameWallet updates wallet and writes deposit ledger entry", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: {
        id: "w1",
        balance: "2",
        totalDeposited: "3",
        totalWithdrawn: "1",
      } as never,
    });

    const txWalletRepo = {
      save: jest.fn(async (w) => w),
    };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const saved = await service.depositToGameWallet(
      "g1",
      "u1",
      "s1",
      5,
      "topup",
    );
    expect(saved.balance).toBe("7");
    expect(saved.totalDeposited).toBe("8");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "deposit",
        amount: "5",
        description: "topup",
      }),
    );
  });

  it("depositToGameWallet uses default description when omitted", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: {
        id: "w1",
        balance: "0",
        totalDeposited: "0",
        totalWithdrawn: "0",
      } as never,
    });
    const txWalletRepo = { save: jest.fn(async (x) => x) };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );
    await service.depositToGameWallet("g1", "u1", "s1", 1);
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Deposit" }),
    );
  });

  it("depositToGameWallet returns current wallet on idempotent replay", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1", balance: "7" } as never,
    });
    ledgerRepo.findOne.mockResolvedValueOnce({
      id: "l1",
      operationKey: "idem-1",
    });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "7",
      totalDeposited: "7",
      totalWithdrawn: "0",
    });

    const result = await service.depositToGameWallet(
      "g1",
      "u1",
      "s1",
      "2",
      undefined,
      "idem-1",
    );

    expect((result as { id: string }).id).toBe("w1");
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it("withdrawFromGameWallet throws on insufficient balance", async () => {
    jest
      .spyOn(service, "getGameWalletBalance")
      .mockResolvedValue({ balance: "3", totalWithdrawn: "0" } as never);

    await expect(
      service.withdrawFromGameWallet("g1", "u1", "s1", 4),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("transferBetweenPlayersInGame rejects self-transfer", async () => {
    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u1", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot transfer to yourself",
    });
  });

  it("updateNFTInstance clamps condition and merges custom attributes", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n1",
      equipped: false,
      condition: 30,
      customAttributes: { speed: 10 },
    });
    nftInstanceRepo.save.mockImplementationOnce(async (x) => x);

    const saved = await service.updateNFTInstance("g1", "u1", "s1", "n1", {
      equipped: true,
      condition: 130,
      customAttributes: { power: 99 },
    });

    expect(saved.equipped).toBe(true);
    expect(saved.condition).toBe(100);
    expect(saved.customAttributes).toEqual({ speed: 10, power: 99 });
  });

  it("updateNFTInstance throws asset not found when ownership does not match", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    nftInstanceRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.updateNFTInstance("g1", "u1", "s1", "missing", {}),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.ASSET_NOT_FOUND,
    });
  });

  it("confirmWalletDepositIntent succeeds and returns wallet on happy path", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });

    const now = new Date();
    const intent = {
      id: "i1",
      amount: "2",
      status: WalletDepositIntentStatus.PENDING,
      expiresAt: new Date(now.getTime() + 60000),
      txHash: null,
      confirmedAt: null,
    };
    const lockedWallet = { id: "w1", balance: "1", totalDeposited: "1" };
    const txIntentRepo = {
      findOne: jest.fn(async () => intent),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest.fn(async () => lockedWallet),
      save: jest.fn(async (x) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const saved = await service.confirmWalletDepositIntent(
      "g1",
      "u1",
      "s1",
      "i1",
      " 0xabcdef1234 ",
    );

    expect(saved.balance).toBe("3");
    expect(saved.totalDeposited).toBe("3");
    expect(intent.status).toBe(WalletDepositIntentStatus.CONFIRMED);
    expect(intent.txHash).toBe("0xabcdef1234");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "deposit",
        intentId: "i1",
        txHash: "0xabcdef1234",
      }),
    );
  });

  it("ensureStudioForUser returns existing studio membership", async () => {
    studioRepo.findOne.mockResolvedValueOnce({ id: "s-existing" });
    const result = await service.ensureStudioForUser("u1");
    expect(result).toEqual({ id: "s-existing" });
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it("ensureStudioForUser creates studio and owner membership when missing", async () => {
    studioRepo.findOne.mockResolvedValueOnce(null);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "owner@test.com",
      walletAddress: "0xwallet",
    });
    studioRepo.save.mockResolvedValueOnce({
      id: "s1",
      email: "owner@test.com",
    });

    const studio = await service.ensureStudioForUser("u1");
    expect(studioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "owner@test.com",
        email: "owner@test.com",
        walletAddress: "0xwallet",
      }),
    );
    expect(studioMemberRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "owner",
      }),
    );
    expect(studioMemberRepo.save).toHaveBeenCalled();
    expect(studio.id).toBe("s1");
  });

  it("getStudioWithRoleForUser rejects non-member", async () => {
    studioMemberRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getStudioWithRoleForUser("s1", "u1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ERROR_MESSAGES.ACCESS_DENIED,
    });
  });

  it("getStudioWithRoleForUser returns studio and role", async () => {
    studioMemberRepo.findOne.mockResolvedValueOnce({
      studio: { id: "s1" },
      role: "owner",
    });
    await expect(service.getStudioWithRoleForUser("s1", "u1")).resolves.toEqual(
      {
        studio: { id: "s1" },
        role: "owner",
      },
    );
  });

  it("createGameForUser rejects unknown studio", async () => {
    studioRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.createGameForUser("u1", "s1", { name: "Game", slug: "game" }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.STUDIO_NOT_FOUND,
    });
  });

  it("createGameForUser creates and saves game", async () => {
    studioRepo.findOne.mockResolvedValueOnce({ id: "s1" });
    gameRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    gameRepo.create.mockImplementationOnce((x) => x);
    gameRepo.save.mockImplementationOnce(async (x) => ({ id: "g1", ...x }));

    const game = await service.createGameForUser("u1", "s1", {
      name: "Game",
      slug: "game",
    });
    expect(game.id).toBe("g1");
    expect(gameRepo.save).toHaveBeenCalled();
  });

  it("createGameForUser rejects duplicate slug within the same studio", async () => {
    studioRepo.findOne.mockResolvedValueOnce({ id: "s1" });
    gameRepo.findOne.mockResolvedValueOnce({ id: "g-existing", slug: "game" });

    await expect(
      service.createGameForUser("u1", "s1", { name: "Game", slug: "game" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "A game with this slug already exists in this studio.",
    });
  });

  it("createGameForUser scopes slug when it collides with another studio", async () => {
    studioRepo.findOne.mockResolvedValueOnce({ id: "studio-abcdef12" });
    gameRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "g-other",
        slug: "game",
        studio: { id: "s2" },
      })
      .mockResolvedValueOnce(null);
    gameRepo.create.mockImplementationOnce((x) => x);
    gameRepo.save.mockImplementationOnce(async (x) => ({ id: "g1", ...x }));

    const game = await service.createGameForUser("u1", "studio-abcdef12", {
      name: "Game",
      slug: "game",
    });

    expect(game.slug).toBe("game-studio-a");
    expect(gameRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "game-studio-a" }),
    );
  });

  it("getGameById rejects unknown game", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.getGameById("g1", "u1", "s1")).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.GAME_NOT_FOUND,
    });
  });

  it("getGameById returns game when found", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    await expect(service.getGameById("g1", "u1", "s1")).resolves.toEqual({
      id: "g1",
      studio: { id: "s1" },
    });
  });

  it("ensureGameWalletForPlayer creates player and wallet when missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    userRepo.findOne.mockResolvedValueOnce({ id: "u1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce(null);
    gamePlayerRepo.create.mockReturnValueOnce({
      id: "gp1",
      user: { id: "u1" },
      game: { id: "g1" },
    });
    gamePlayerRepo.save.mockImplementationOnce(async (x) => x);
    walletRepo.findOne.mockResolvedValueOnce(null);
    walletRepo.create.mockReturnValueOnce({
      id: "w1",
      balance: "0",
      totalDeposited: "0",
      totalWithdrawn: "0",
    });
    walletRepo.save.mockImplementationOnce(async (x) => x);

    const result = await service.ensureGameWalletForPlayer("g1", "u1", "s1");
    expect(result.gamePlayer.id).toBe("gp1");
    expect(result.wallet.id).toBe("w1");
  });

  it("getGameWalletLedger loads entries in descending timestamp order", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    ledgerRepo.find.mockResolvedValueOnce([]);

    await service.getGameWalletLedger("g1", "u1", "s1");
    expect(ledgerRepo.find).toHaveBeenCalledWith({
      where: { wallet: { id: "w1" } },
      order: { createdAt: "DESC" },
    });
  });

  it("withdrawFromGameWallet updates wallet and writes withdrawal ledger entry", async () => {
    jest.spyOn(service, "getGameWalletBalance").mockResolvedValue({
      id: "w1",
      balance: "10",
      totalWithdrawn: "1",
    } as never);

    const txWalletRepo = { save: jest.fn(async (x) => x) };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const saved = await service.withdrawFromGameWallet(
      "g1",
      "u1",
      "s1",
      4,
      "cashout",
    );
    expect(saved.balance).toBe("6");
    expect(saved.totalWithdrawn).toBe("5");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "withdraw",
        amount: "4",
        description: "cashout",
      }),
    );
  });

  it("withdrawFromGameWallet uses default description when omitted", async () => {
    jest.spyOn(service, "getGameWalletBalance").mockResolvedValue({
      id: "w1",
      balance: "5",
      totalWithdrawn: "0",
    } as never);
    const txWalletRepo = { save: jest.fn(async (x) => x) };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );
    await service.withdrawFromGameWallet("g1", "u1", "s1", 1);
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Withdrawal" }),
    );
  });

  it("getNFTTemplatesForGame verifies access and returns templates", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    nftTemplateRepo.find.mockResolvedValueOnce([{ id: "t1" }]);
    const rows = await service.getNFTTemplatesForGame("g1", "s1");
    expect(rows).toEqual([{ id: "t1" }]);
  });

  it("createNFTTemplate applies default values", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    nftTemplateRepo.create.mockImplementationOnce((x) => x);
    nftTemplateRepo.save.mockImplementationOnce(async (x) => x);

    const tpl = await service.createNFTTemplate("g1", "s1", { name: "Sword" });
    expect(tpl).toEqual(
      expect.objectContaining({
        name: "Sword",
        tier: 1,
        attributes: {},
        upkeepCostPerDay: "0",
        mintingCost: "0",
        currentMintCount: 0,
      }),
    );
  });

  it("mintNFTToPlayer rejects when max mint count reached", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    nftTemplateRepo.findOne.mockResolvedValueOnce({
      id: "t1",
      name: "Sword",
      currentMintCount: 2,
      maxMintCount: 2,
      game: { id: "g1" },
    });

    await expect(service.mintNFTToPlayer("g1", "s1", "t1")).rejects.toThrow(
      "Max mint count reached for this template",
    );
  });

  it("mintNFTToPlayer creates NFT instance and increments mint count", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const template = {
      id: "t1",
      name: "Sword",
      currentMintCount: 0,
      maxMintCount: 10,
      game: { id: "g1" },
    };
    nftTemplateRepo.findOne.mockResolvedValueOnce(template);
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    nftInstanceRepo.create.mockImplementationOnce((x) => x);
    nftInstanceRepo.save.mockImplementationOnce(async (x) => x);
    nftTemplateRepo.save.mockImplementationOnce(async (x) => x);

    const nft = await service.mintNFTToPlayer("g1", "s1", "t1");
    expect(nft.name).toBe("Sword #1");
    expect(template.currentMintCount).toBe(1);
  });

  it("mintNFTToPlayer still succeeds when economics logEvent rejects", async () => {
    economicsService.logEvent.mockRejectedValueOnce(new Error("log failed"));
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const template = {
      id: "t1",
      name: "Shield",
      currentMintCount: 0,
      maxMintCount: null,
      game: { id: "g1" },
    };
    nftTemplateRepo.findOne.mockResolvedValueOnce(template);
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    nftInstanceRepo.create.mockImplementationOnce((x) => x);
    nftInstanceRepo.save.mockImplementationOnce(async (x) => x);
    nftTemplateRepo.save.mockImplementationOnce(async (x) => x);

    const nft = await service.mintNFTToPlayer("g1", "s1", "t1");
    expect(nft.name).toBe("Shield #1");
    // Allow the void promise to settle so the catch handler runs
    await new Promise((r) => setTimeout(r, 0));
  });

  it("transferBetweenPlayersInGame returns user-not-found when sender user is missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) {
            return { findOne: jest.fn(async () => null) };
          }
          return {
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => x),
          };
        },
      }),
    );

    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u2", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("personal account placeholder methods return 501", () => {
    expect(() =>
      service.createPersonalAccount("s1", "a@b.com", "pw", { reports: true }),
    ).toThrow(AppException);
    expect(() => service.getStudioUsers("s1")).toThrow(AppException);
    expect(() => service.loginStudioUser("s1", "a@b.com", "pw")).toThrow(
      AppException,
    );
    expect(() =>
      service.updatePersonalAccountPermissions("s1", "u1", { reports: true }),
    ).toThrow(AppException);
  });

  it("ensureStudioForUser throws when user does not exist", async () => {
    studioRepo.findOne.mockResolvedValueOnce(null);
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.ensureStudioForUser("u404")).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("getStudiosForUser delegates query builder", async () => {
    const getMany = jest.fn().mockResolvedValue([{ id: "s1" }]);
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany,
    };
    (
      studioRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(qb);

    await expect(service.getStudiosForUser("u1")).resolves.toEqual([
      { id: "s1" },
    ]);
  });

  it("getGamesForUser delegates repository find", async () => {
    gameRepo.find.mockResolvedValueOnce([{ id: "g1" }]);
    await expect(service.getGamesForUser("s1")).resolves.toEqual([
      { id: "g1" },
    ]);
    expect(gameRepo.find).toHaveBeenCalledWith({
      where: { studio: { id: "s1" } },
    });
  });

  it("getGameWalletBalance delegates ensureGameWalletForPlayer", async () => {
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    await expect(
      service.getGameWalletBalance("g1", "u1", "s1"),
    ).resolves.toEqual({
      id: "w1",
    });
  });

  it("createWalletDepositIntent throws when user not found", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.createWalletDepositIntent("g1", "u404", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("confirmWalletDepositIntent throws when intent is missing", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const txIntentRepo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(),
    };
    const txWalletRepo = { findOne: jest.fn(), save: jest.fn() };
    const txLedgerRepo = { create: jest.fn(), save: jest.fn() };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i404",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Deposit intent not found",
    });
  });

  it("confirmWalletDepositIntent throws when intent is not pending", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const txIntentRepo = {
      findOne: jest.fn(async () => ({
        id: "i1",
        status: WalletDepositIntentStatus.CONFIRMED,
      })),
      save: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet)
            return { findOne: jest.fn(), save: jest.fn() };
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn() };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Deposit intent is not pending",
    });
  });

  it("confirmWalletDepositIntent marks expired intent inside transaction", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const intent = {
      id: "i1",
      status: WalletDepositIntentStatus.PENDING,
      expiresAt: new Date(Date.now() - 1000),
    };
    const txIntentRepo = {
      findOne: jest.fn(async () => intent),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet)
            return { findOne: jest.fn(), save: jest.fn() };
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn() };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Deposit intent has expired",
    });
    expect(intent.status).toBe(WalletDepositIntentStatus.EXPIRED);
    expect(txIntentRepo.save).toHaveBeenCalled();
  });

  it("confirmWalletDepositIntent rethrows unknown query failures", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const qf = new QueryFailedError("INSERT", [], new Error("boom"));
    (
      qf as QueryFailedError & {
        driverError?: Error & { code?: string; constraint?: string };
      }
    ).driverError = Object.assign(new Error("other"), {
      code: "99999",
      constraint: "something_else",
    });
    dataSource.transaction.mockRejectedValueOnce(qf);
    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toBe(qf);
  });

  it("confirmWalletDepositIntent throws when locked wallet is missing", async () => {
    gameRepo.findOne.mockResolvedValue({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    const txIntentRepo = {
      findOne: jest.fn(async () => ({
        id: "i1",
        amount: "2",
        status: WalletDepositIntentStatus.PENDING,
        expiresAt: new Date(Date.now() + 10000),
      })),
      save: jest.fn(),
    };
    const txWalletRepo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === WalletDepositIntent) return txIntentRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn() };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.confirmWalletDepositIntent(
        "g1",
        "u1",
        "s1",
        "i1",
        "0xabcdef1234",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Game wallet not found",
    });
  });

  it("transferBetweenPlayersInGame handles happy path", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });

    const fromUser = { id: "u1" };
    const toUser = { id: "u2" };
    const fromPlayer = { id: "gp1", user: fromUser, game: { id: "g1" } };
    const toPlayer = { id: "gp2", user: toUser, game: { id: "g1" } };
    const fromWallet = {
      id: "w1",
      gamePlayer: fromPlayer,
      balance: "10",
      totalWithdrawn: "1",
    };
    const toWallet = {
      id: "w2",
      gamePlayer: toPlayer,
      balance: "2",
      totalDeposited: "3",
    };

    const txUserRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser),
    };
    const txPlayerRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromPlayer)
        .mockResolvedValueOnce(toPlayer),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet)
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };

    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          if (entity === GamePlayer) return txPlayerRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const result = await service.transferBetweenPlayersInGame(
      "g1",
      "u1",
      "u2",
      "s1",
      4,
      "gift",
    );
    expect(result.fromWallet.balance).toBe("6");
    expect(result.toWallet.balance).toBe("6");
    expect(txLedgerRepo.save).toHaveBeenCalledTimes(2);
  });

  it("transferBetweenPlayersInGame throws when recipient user is missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const txUserRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: "u1" })
        .mockResolvedValueOnce(null),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          return {
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => x),
          };
        },
      }),
    );

    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u2", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("transferBetweenPlayersInGame creates missing players/wallets then fails insufficient balance", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const txUserRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: "u1" })
        .mockResolvedValueOnce({ id: "u2" }),
    };
    const createdFromPlayer = { id: "gp1", user: { id: "u1" } };
    const createdToPlayer = { id: "gp2", user: { id: "u2" } };
    const createdFromWallet = {
      id: "w1",
      gamePlayer: createdFromPlayer,
      balance: "0",
      totalWithdrawn: "0",
    };
    const createdToWallet = {
      id: "w2",
      gamePlayer: createdToPlayer,
      balance: "0",
      totalDeposited: "0",
    };
    const txPlayerRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest
        .fn()
        .mockReturnValueOnce(createdFromPlayer)
        .mockReturnValueOnce(createdToPlayer),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdFromWallet)
        .mockResolvedValueOnce(createdToWallet),
      create: jest
        .fn()
        .mockReturnValueOnce(createdFromWallet)
        .mockReturnValueOnce(createdToWallet),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          if (entity === GamePlayer) return txPlayerRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn(async (x) => x) };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u2", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
    expect(txPlayerRepo.create).toHaveBeenCalledTimes(2);
    expect(txWalletRepo.create).toHaveBeenCalledTimes(2);
  });

  it("transferBetweenPlayersInGame throws when sender lock fails", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const fromUser = { id: "u1" };
    const toUser = { id: "u2" };
    const fromPlayer = { id: "gp1", user: fromUser };
    const toPlayer = { id: "gp2", user: toUser };
    const fromWallet = {
      id: "w1",
      gamePlayer: fromPlayer,
      balance: "10",
      totalWithdrawn: "0",
    };
    const toWallet = {
      id: "w2",
      gamePlayer: toPlayer,
      balance: "1",
      totalDeposited: "0",
    };
    const txUserRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser),
    };
    const txPlayerRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromPlayer)
        .mockResolvedValueOnce(toPlayer),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet)
        .mockResolvedValueOnce(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          if (entity === GamePlayer) return txPlayerRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn(async (x) => x) };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u2", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Sender wallet not found",
    });
  });

  it("transferBetweenPlayersInGame throws when recipient lock fails", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const fromUser = { id: "u1" };
    const toUser = { id: "u2" };
    const fromPlayer = { id: "gp1", user: fromUser };
    const toPlayer = { id: "gp2", user: toUser };
    const fromWallet = {
      id: "w1",
      gamePlayer: fromPlayer,
      balance: "10",
      totalWithdrawn: "0",
    };
    const toWallet = {
      id: "w2",
      gamePlayer: toPlayer,
      balance: "1",
      totalDeposited: "0",
    };
    const txUserRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromUser)
        .mockResolvedValueOnce(toUser),
    };
    const txPlayerRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromPlayer)
        .mockResolvedValueOnce(toPlayer),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet)
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          if (entity === GamePlayer) return txPlayerRepo;
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry)
            return { create: jest.fn(), save: jest.fn(async (x) => x) };
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.transferBetweenPlayersInGame("g1", "u1", "u2", "s1", 1),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Recipient wallet not found",
    });
  });

  it("getNFTTemplatesForGame rejects when game is missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getNFTTemplatesForGame("g404", "s1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.GAME_NOT_FOUND,
    });
  });

  it("getNFTTemplatesForGame rejects when game does not belong to studio", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s2" } });
    await expect(
      service.getNFTTemplatesForGame("g1", "s1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ERROR_MESSAGES.ACCESS_DENIED,
    });
  });

  it("getPlayerNFTs returns nft instances for ensured player", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    jest.spyOn(service, "ensureGameWalletForPlayer").mockResolvedValue({
      gamePlayer: { id: "gp1" } as never,
      wallet: { id: "w1" } as never,
    });
    nftInstanceRepo.find.mockResolvedValueOnce([{ id: "n1" }]);
    await expect(service.getPlayerNFTs("g1", "u1", "s1")).resolves.toEqual([
      { id: "n1" },
    ]);
  });

  it("mintNFTToPlayer throws when no game player exists", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    nftTemplateRepo.findOne.mockResolvedValueOnce({
      id: "t1",
      name: "Sword",
      currentMintCount: 0,
      maxMintCount: 2,
      game: { id: "g1" },
    });
    gamePlayerRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.mintNFTToPlayer("g1", "s1", "t1")).rejects.toThrow(
      "No game player found for minting",
    );
  });

  it("mintNFTToPlayer throws when game is missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.mintNFTToPlayer("g404", "s1", "t1")).rejects.toThrow(
      "Game not found or access denied",
    );
  });

  it("mintNFTToPlayer throws when template is missing", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    nftTemplateRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.mintNFTToPlayer("g1", "s1", "t404")).rejects.toThrow(
      "NFT template not found",
    );
  });

  it("createGameForUser appends random suffix when scoped slug also collides", async () => {
    studioRepo.findOne.mockResolvedValueOnce({ id: "studio-abcdef12" });
    gameRepo.findOne
      .mockResolvedValueOnce(null) // no same-studio conflict
      .mockResolvedValueOnce({
        id: "g-other",
        slug: "game",
        studio: { id: "s2" },
      }) // global conflict → build scoped slug
      .mockResolvedValueOnce({ id: "g-scoped", slug: "game-studio-a" }) // scoped slug taken → enter while body
      .mockResolvedValueOnce(null); // UUID-suffixed slug is free
    gameRepo.create.mockImplementationOnce((x) => x);
    gameRepo.save.mockImplementationOnce(async (x) => ({ id: "g2", ...x }));

    const game = await service.createGameForUser("u1", "studio-abcdef12", {
      name: "Game",
      slug: "game",
    });

    expect(game.slug).toMatch(/^game-studio-a-[0-9a-f]{4}$/);
  });

  it("getPublicGameList returns id/name/slug ordered by name", async () => {
    const games = [
      { id: "g1", name: "Alpha", slug: "alpha" },
      { id: "g2", name: "Beta", slug: "beta" },
    ];
    gameRepo.find.mockResolvedValueOnce(games);

    const result = await service.getPublicGameList();

    expect(result).toBe(games);
    expect(gameRepo.find).toHaveBeenCalledWith({
      select: ["id", "name", "slug"],
      order: { name: "ASC" },
    });
  });

  it("getAllNFTsForWallet returns empty array when wallet identity and user are missing", async () => {
    walletIdentityRepo.findOne.mockResolvedValueOnce(null);
    userRepo.findOne.mockResolvedValueOnce(null);

    const result = await service.getAllNFTsForWallet("0xabc");

    expect(result).toEqual([]);
  });

  it("getAllNFTsForWallet returns NFT instances for known wallet identity", async () => {
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    const instances = [{ id: "n1" }, { id: "n2" }];
    nftInstanceRepo.find.mockResolvedValueOnce(instances);

    const result = await service.getAllNFTsForWallet("0xABC");

    expect(walletIdentityRepo.findOne).toHaveBeenCalledWith({
      where: { walletAddress: "0xabc" },
    });
    expect(result).toBe(instances);
  });

  it("getGamePlayers returns players for a game", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const players = [{ id: "p1" }];
    gamePlayerRepo.find.mockResolvedValueOnce(players);

    const result = await service.getGamePlayers("g1", "s1");

    expect(result).toBe(players);
  });

  it("getAllNFTInstancesForGame returns instances for a game", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    const instances = [{ id: "n1" }];
    nftInstanceRepo.find.mockResolvedValueOnce(instances);

    const result = await service.getAllNFTInstancesForGame("g1", "s1");

    expect(result).toBe(instances);
  });

  // ─── New player-facing wallet operation tests ───────────────────────────────

  it("registerPlayerByWallet throws when game not found", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.registerPlayerByWallet(
        "g404",
        "0x1234567890123456789012345678901234567890",
        "s1",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("registerPlayerByWallet creates wallet identity and game player for new wallet", async () => {
    // assertGameBelongsToStudio
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    // resolvePlayerGameWallet → gameRepo.findOne
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    // wallet identity not found → create
    walletIdentityRepo.findOne.mockResolvedValueOnce(null);
    walletIdentityRepo.save.mockResolvedValueOnce({
      id: "wid-new",
      walletAddress: "0x1234",
    });
    // ensureGamePlayer → not found → create
    gamePlayerRepo.findOne.mockResolvedValueOnce(null);
    gamePlayerRepo.save.mockResolvedValueOnce({ id: "gp-new" });
    // ensureWalletForGamePlayer → not found → create
    walletRepo.findOne.mockResolvedValueOnce(null);
    walletRepo.save.mockResolvedValueOnce({ id: "w-new", balance: "0" });

    const result = await service.registerPlayerByWallet(
      "g1",
      "0x1234567890123456789012345678901234567890",
      "s1",
    );

    expect(walletIdentityRepo.save).toHaveBeenCalled();
    expect(result.gamePlayer.id).toBe("gp-new");
    expect(result.wallet.id).toBe("w-new");
  });

  it("getPlayerGameWallet returns null when game not found", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getPlayerGameWallet(
        "g404",
        "0x1234567890123456789012345678901234567890",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("getPlayerGameWallet returns null when wallet identity not found by wallet", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce(null);
    const result = await service.getPlayerGameWallet("g1", "0xabc");
    expect(result).toBeNull();
  });

  it("getPlayerGameWallet returns wallet when player exists", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({ id: "w1", balance: "5" });

    const result = await service.getPlayerGameWallet("g1", "0xabc");
    expect(result?.id).toBe("w1");
  });

  it("playerWithdrawFromGameWallet throws on insufficient balance", async () => {
    // resolvePlayerGameWallet flow
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "2",
      totalWithdrawn: "0",
    });

    await expect(
      service.playerWithdrawFromGameWallet("g1", "0xabc", 5),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("playerWithdrawFromGameWallet succeeds and updates balance", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "10",
      totalWithdrawn: "0",
    });

    const txWalletRepo = { save: jest.fn(async (x: unknown) => x) };
    const txLedgerRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry) return txLedgerRepo;
            throw new Error("unexpected repository");
          },
        }),
    );

    const result = await service.playerWithdrawFromGameWallet("g1", "0xabc", 4);
    expect((result as { balance: string }).balance).toBe("6");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "withdraw", amount: "4" }),
    );
  });

  it("playerTransferBetweenPlayers rejects self-transfer", async () => {
    await expect(
      service.playerTransferBetweenPlayers("g1", "0xabc", "0xABC", 1),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot transfer to yourself",
    });
  });

  it("playerTransferBetweenPlayers succeeds and updates both wallets", async () => {
    // resolvePlayerGameWallet for fromWallet
    gameRepo.findOne
      .mockResolvedValueOnce({ id: "g1" })
      .mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne
      .mockResolvedValueOnce({ id: "wid1" })
      .mockResolvedValueOnce({ id: "wid2" });
    gamePlayerRepo.findOne
      .mockResolvedValueOnce({ id: "gp1" })
      .mockResolvedValueOnce({ id: "gp2" });
    walletRepo.findOne
      .mockResolvedValueOnce({ id: "w1", balance: "10", totalWithdrawn: "0" })
      .mockResolvedValueOnce({ id: "w2", balance: "0", totalDeposited: "0" });

    const lockedFrom = { id: "w1", balance: "10", totalWithdrawn: "0" };
    const lockedTo = { id: "w2", balance: "0", totalDeposited: "0" };
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lockedFrom)
        .mockResolvedValueOnce(lockedTo),
      save: jest.fn(async (x: unknown) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry) return txLedgerRepo;
            throw new Error("unexpected repository");
          },
        }),
    );

    const result = await service.playerTransferBetweenPlayers(
      "g1",
      "0xaaa",
      "0xbbb",
      4,
    );
    expect(
      (result as { fromWallet: { balance: string } }).fromWallet.balance,
    ).toBe("6");
    expect((result as { toWallet: { balance: string } }).toWallet.balance).toBe(
      "4",
    );
    expect(txLedgerRepo.save).toHaveBeenCalledTimes(2);
  });

  it("playerTransferBetweenPlayers returns current wallets on idempotent replay", async () => {
    const fromWallet = { id: "w-from", balance: "4" };
    const toWallet = { id: "w-to", balance: "6" };

    mockResolvePlayer({ id: "gp-from" }, fromWallet);
    mockResolvePlayer({ id: "gp-to" }, toWallet);
    ledgerRepo.findOne
      .mockResolvedValueOnce({ id: "l-debit", operationKey: "idem-x:debit" })
      .mockResolvedValueOnce({ id: "l-credit", operationKey: "idem-x:credit" });
    walletRepo.findOne
      .mockResolvedValueOnce(fromWallet)
      .mockResolvedValueOnce(toWallet);

    const result = await service.playerTransferBetweenPlayers(
      "g1",
      "0xfrom",
      "0xto",
      "1",
      "idem-x",
    );

    expect(result).toEqual({ fromWallet, toWallet });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it("playerTransferBetweenPlayers rejects insufficient balance", async () => {
    // resolvePlayerGameWallet for fromWallet
    gameRepo.findOne
      .mockResolvedValueOnce({ id: "g1" })
      .mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne
      .mockResolvedValueOnce({ id: "wid1" })
      .mockResolvedValueOnce({ id: "wid2" });
    gamePlayerRepo.findOne
      .mockResolvedValueOnce({ id: "gp1" })
      .mockResolvedValueOnce({ id: "gp2" });
    walletRepo.findOne
      .mockResolvedValueOnce({ id: "w1", balance: "1", totalWithdrawn: "0" })
      .mockResolvedValueOnce({ id: "w2", balance: "0", totalDeposited: "0" });

    // The lock inside transaction
    const txWalletRepo = {
      findOne: jest.fn().mockResolvedValueOnce({ id: "w1", balance: "1" }),
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry)
              return { create: jest.fn((x: unknown) => x), save: jest.fn() };
            throw new Error("unexpected");
          },
        }),
    );

    await expect(
      service.playerTransferBetweenPlayers("g1", "0xaaa", "0xbbb", 5),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("playerTransferBetweenPlayers throws in TOCTOU scenario where locked balance < amount", async () => {
    gameRepo.findOne
      .mockResolvedValueOnce({ id: "g1" })
      .mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne
      .mockResolvedValueOnce({ id: "wid1" })
      .mockResolvedValueOnce({ id: "wid2" });
    gamePlayerRepo.findOne
      .mockResolvedValueOnce({ id: "gp1" })
      .mockResolvedValueOnce({ id: "gp2" });
    // Pre-check: balance "10", amount 5 → passes (5 > 10 is false)
    walletRepo.findOne
      .mockResolvedValueOnce({ id: "w1", balance: "10", totalWithdrawn: "0" })
      .mockResolvedValueOnce({ id: "w2", balance: "0", totalDeposited: "0" });

    // Inside transaction: locked balance is now "4" (TOCTOU — 5 > 4 → throws)
    const txWalletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: "w1", balance: "4" })
        .mockResolvedValueOnce({ id: "w2", balance: "0" }),
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry)
              return { create: jest.fn((x: unknown) => x), save: jest.fn() };
            throw new Error("unexpected");
          },
        }),
    );

    await expect(
      service.playerTransferBetweenPlayers("g1", "0xaaa", "0xbbb", 5),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("getNFTShopTemplates throws when game not found", async () => {
    gameRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.getNFTShopTemplates("g404")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("getNFTShopTemplates returns only templates with minting cost > 0", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    const allTemplates = [
      { id: "t1", mintingCost: "5" },
      { id: "t2", mintingCost: "0" },
      { id: "t3", mintingCost: "10.5" },
    ];
    nftTemplateRepo.find.mockResolvedValueOnce(allTemplates);

    const result = await service.getNFTShopTemplates("g1");
    expect(result).toEqual([
      { id: "t1", mintingCost: "5" },
      { id: "t3", mintingCost: "10.5" },
    ]);
    expect(nftTemplateRepo.find).toHaveBeenCalledWith({
      where: { game: { id: "g1" } },
    });
  });

  it("purchaseNFTFromShop throws when template not found", async () => {
    nftTemplateRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.purchaseNFTFromShop("g1", "0xabc", "t404"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("purchaseNFTFromShop throws when max mint count reached", async () => {
    nftTemplateRepo.findOne.mockResolvedValueOnce({
      id: "t1",
      name: "Sword",
      mintingCost: "5",
      currentMintCount: 2,
      maxMintCount: 2,
      game: { id: "g1" },
    });
    await expect(
      service.purchaseNFTFromShop("g1", "0xabc", "t1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Max mint count reached for this NFT",
    });
  });

  it("purchaseNFTFromShop throws when insufficient balance", async () => {
    nftTemplateRepo.findOne.mockResolvedValueOnce({
      id: "t1",
      name: "Sword",
      mintingCost: "10",
      currentMintCount: 0,
      maxMintCount: null,
      game: { id: "g1" },
    });
    // resolvePlayerGameWallet
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "3",
      totalWithdrawn: "0",
    });

    await expect(
      service.purchaseNFTFromShop("g1", "0xabc", "t1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("purchaseNFTFromShop throws when locked wallet has insufficient balance (TOCTOU)", async () => {
    nftTemplateRepo.findOne.mockResolvedValueOnce({
      id: "t1",
      name: "Sword",
      mintingCost: "5",
      currentMintCount: 0,
      maxMintCount: null,
      game: { id: "g1" },
    });
    // resolvePlayerGameWallet
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    // pre-check passes: balance "5" (5 > 5 is false)
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "5",
      totalWithdrawn: "0",
    });

    // inside transaction, locked balance is now "4" (TOCTOU)
    const txWalletRepo = {
      findOne: jest.fn().mockResolvedValueOnce({ id: "w1", balance: "4" }),
      save: jest.fn(async (x: unknown) => x),
    };
    const noop = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry) return noop;
            if (entity === NFTInstance) return noop;
            if (entity === NFTTemplate) return noop;
            throw new Error(`unexpected: ${String(entity)}`);
          },
        }),
    );

    await expect(
      service.purchaseNFTFromShop("g1", "0xabc", "t1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    });
  });

  it("purchaseNFTFromShop mints NFT and deducts wallet balance", async () => {
    const template = {
      id: "t1",
      name: "Sword",
      mintingCost: "5",
      currentMintCount: 0,
      maxMintCount: null,
      game: { id: "g1" },
    };
    nftTemplateRepo.findOne.mockResolvedValueOnce(template);
    // resolvePlayerGameWallet
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "20",
      totalWithdrawn: "0",
    });

    const lockedWallet = { id: "w1", balance: "20", totalWithdrawn: "0" };
    const txWalletRepo = {
      findOne: jest.fn().mockResolvedValueOnce(lockedWallet),
      save: jest.fn(async (x: unknown) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    };
    const txNftInstanceRepo = {
      create: jest.fn((x: unknown) => ({ ...(x as object), id: "n-new" })),
      save: jest.fn(async (x: unknown) => x),
    };
    const txNftTemplateRepo = {
      save: jest.fn(async (x: unknown) => x),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === GameWallet) return txWalletRepo;
            if (entity === LedgerEntry) return txLedgerRepo;
            if (entity === NFTInstance) return txNftInstanceRepo;
            if (entity === NFTTemplate) return txNftTemplateRepo;
            throw new Error(`unexpected repository: ${String(entity)}`);
          },
        }),
    );

    const result = await service.purchaseNFTFromShop("g1", "0xabc", "t1");
    expect((result as { nft: { name: string } }).nft.name).toBe("Sword #1");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "withdraw", amount: "5" }),
    );
    expect(template.currentMintCount).toBe(1);
  });

  it("purchaseNFTFromShop returns replay result for same idempotency key", async () => {
    const template = {
      id: "t1",
      name: "Sword",
      mintingCost: "5",
      currentMintCount: 0,
      maxMintCount: null,
      game: { id: "g1" },
    };
    nftTemplateRepo.findOne.mockResolvedValueOnce(template);
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid1" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp1" });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "20",
      totalWithdrawn: "0",
    });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n-existing",
      purchaseOperationKey: "shop-1",
      owner: { id: "gp1" },
      template: { id: "t1" },
      name: "Sword #1",
    });
    walletRepo.findOne.mockResolvedValueOnce({
      id: "w1",
      balance: "15",
      totalWithdrawn: "5",
    });

    const result = await service.purchaseNFTFromShop(
      "g1",
      "0xabc",
      "t1",
      "shop-1",
    );

    expect((result as { nft: { id: string } }).nft.id).toBe("n-existing");
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it("playerTransferNFT rejects self-transfer", async () => {
    await expect(
      service.playerTransferNFT("g1", "0xABC", "0xabc", "n1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot transfer to yourself",
    });
  });

  it("playerTransferNFT throws asset not found when NFT not owned by sender", async () => {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne.mockResolvedValueOnce({ id: "wid-from" });
    gamePlayerRepo.findOne.mockResolvedValueOnce({ id: "gp-from" });
    walletRepo.findOne.mockResolvedValueOnce({ id: "w-from", balance: "0" });
    nftInstanceRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.playerTransferNFT("g1", "0xfrom", "0xto", "missing-nft"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.ASSET_NOT_FOUND,
    });
  });

  it("playerTransferNFT transfers NFT ownership to recipient", async () => {
    const fromPlayer = { id: "gp-from" };
    const toPlayer = { id: "gp-to" };
    gameRepo.findOne
      .mockResolvedValueOnce({ id: "g1" })
      .mockResolvedValueOnce({ id: "g1" });
    walletIdentityRepo.findOne
      .mockResolvedValueOnce({ id: "wid-from" })
      .mockResolvedValueOnce({ id: "wid-to" });
    gamePlayerRepo.findOne
      .mockResolvedValueOnce(fromPlayer)
      .mockResolvedValueOnce(toPlayer);
    walletRepo.findOne
      .mockResolvedValueOnce({ id: "w-from", balance: "0" })
      .mockResolvedValueOnce({ id: "w-to", balance: "0" });

    const nftInstance = { id: "n1", owner: fromPlayer, template: {} };
    nftInstanceRepo.findOne.mockResolvedValueOnce(nftInstance);
    nftInstanceRepo.save.mockImplementationOnce(async (x: unknown) => x);

    const result = await service.playerTransferNFT(
      "g1",
      "0xfrom",
      "0xto",
      "n1",
    );
    expect((result as { owner: { id: string } }).owner.id).toBe("gp-to");
    expect(nftInstanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ owner: toPlayer }),
    );
  });

  // ─── Marketplace ──────────────────────────────────────────────────────────

  /** Set up the mock chain that resolvePlayerGameWallet needs */
  function mockResolvePlayer(
    gamePlayer: { id: string },
    wallet: { id?: string; balance: string; totalWithdrawn?: string },
  ) {
    gameRepo.findOne.mockResolvedValueOnce({ id: "g1", studio: { id: "s1" } });
    walletIdentityRepo.findOne.mockResolvedValueOnce({
      id: "wid1",
      walletAddress: "0xabc",
    });
    gamePlayerRepo.findOne.mockResolvedValueOnce(gamePlayer);
    walletRepo.findOne.mockResolvedValueOnce(wallet);
  }

  it("getGameListings returns active listings for a game", async () => {
    const listings = [{ id: "l1", status: "active" }];
    marketplaceListingRepo.find.mockResolvedValueOnce(listings);
    await expect(service.getGameListings("g1")).resolves.toEqual(listings);
    expect(marketplaceListingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { game: { id: "g1" }, status: "active" },
      }),
    );
  });

  it("createNFTListing creates and saves a new listing", async () => {
    const gamePlayer = { id: "gp1" };
    mockResolvePlayer(gamePlayer, { balance: "50" });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n1",
      owner: gamePlayer,
      template: {},
    });
    marketplaceListingRepo.findOne.mockResolvedValueOnce(null);
    gameRepo.findOneBy!.mockResolvedValueOnce({ id: "g1" });
    marketplaceListingRepo.create.mockImplementationOnce((x) => x);
    marketplaceListingRepo.save.mockResolvedValueOnce({
      id: "listing1",
      status: "active",
      askPrice: "10",
    });

    const result = await service.createNFTListing("g1", "0xseller", "n1", "10");
    expect(result).toMatchObject({ id: "listing1", status: "active" });
    expect(marketplaceListingRepo.save).toHaveBeenCalled();
  });

  it("createNFTListing throws 404 when NFT not owned by player", async () => {
    mockResolvePlayer({ id: "gp1" }, { balance: "50" });
    nftInstanceRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createNFTListing("g1", "0xseller", "n1", "10"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("createNFTListing throws 409 when NFT already listed", async () => {
    const gamePlayer = { id: "gp1" };
    mockResolvePlayer(gamePlayer, { balance: "50" });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n1",
      owner: gamePlayer,
      template: {},
    });
    marketplaceListingRepo.findOne.mockResolvedValueOnce({ id: "existing" });

    await expect(
      service.createNFTListing("g1", "0xseller", "n1", "10"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This NFT is already listed in the marketplace",
    });
  });

  it("createNFTListing returns existing listing for replay by same seller", async () => {
    const gamePlayer = { id: "gp1" };
    mockResolvePlayer(gamePlayer, { balance: "50" });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n1",
      owner: gamePlayer,
      template: {},
    });
    marketplaceListingRepo.findOne.mockResolvedValueOnce({
      id: "existing",
      status: "active",
      seller: { id: "gp1" },
    });

    const result = await service.createNFTListing("g1", "0xseller", "n1", "10");

    expect((result as { id: string }).id).toBe("existing");
    expect(marketplaceListingRepo.save).not.toHaveBeenCalled();
  });

  it("createNFTListing throws 404 when game not found", async () => {
    const gamePlayer = { id: "gp1" };
    mockResolvePlayer(gamePlayer, { balance: "50" });
    nftInstanceRepo.findOne.mockResolvedValueOnce({
      id: "n1",
      owner: gamePlayer,
      template: {},
    });
    marketplaceListingRepo.findOne.mockResolvedValueOnce(null);
    gameRepo.findOneBy!.mockResolvedValueOnce(null);

    await expect(
      service.createNFTListing("g1", "0xseller", "n1", "10"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cancelNFTListing cancels the listing and saves", async () => {
    const gamePlayer = { id: "gp1" };
    mockResolvePlayer(gamePlayer, { balance: "0" });
    const listing = { id: "l1", status: "active", seller: { id: "gp1" } };
    marketplaceListingRepo.findOne.mockResolvedValueOnce(listing);
    marketplaceListingRepo.save.mockResolvedValueOnce({
      ...listing,
      status: "cancelled",
    });

    const result = await service.cancelNFTListing("g1", "0xseller", "l1");
    expect((result as { status: string }).status).toBe("cancelled");
  });

  it("cancelNFTListing throws 404 when listing not found", async () => {
    mockResolvePlayer({ id: "gp1" }, { balance: "0" });
    marketplaceListingRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.cancelNFTListing("g1", "0xseller", "l1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Listing not found" });
  });

  it("cancelNFTListing throws 403 when caller is not the seller", async () => {
    mockResolvePlayer({ id: "gp1" }, { balance: "0" });
    marketplaceListingRepo.findOne.mockResolvedValueOnce({
      id: "l1",
      status: "active",
      seller: { id: "gp-other" },
    });

    await expect(
      service.cancelNFTListing("g1", "0xseller", "l1"),
    ).rejects.toMatchObject({ statusCode: 403, message: "Not your listing" });
  });

  it("cancelNFTListing returns listing when already cancelled by same seller", async () => {
    mockResolvePlayer({ id: "gp1" }, { balance: "0" });
    marketplaceListingRepo.findOne.mockResolvedValueOnce({
      id: "l1",
      status: "cancelled",
      seller: { id: "gp1" },
    });

    const result = await service.cancelNFTListing("g1", "0xseller", "l1");

    expect((result as { status: string }).status).toBe("cancelled");
    expect(marketplaceListingRepo.save).not.toHaveBeenCalled();
  });

  it("purchaseNFTListing transfers NFT and balances", async () => {
    const buyerPlayer = { id: "gp-buyer" };
    const sellerPlayer = { id: "gp-seller" };
    const buyerWallet = { id: "w-buyer", balance: "100", totalWithdrawn: "0" };
    const sellerWallet = { id: "w-seller", balance: "0", totalDeposited: "0" };
    const nftInstance = { id: "n1", owner: sellerPlayer };
    const listing = {
      id: "l1",
      status: "active",
      askPrice: "10",
      seller: sellerPlayer,
      nftInstance,
    };

    mockResolvePlayer(buyerPlayer, buyerWallet);
    const txWalletRepo = {
      findOne: jest.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id === "w-buyer") return buyerWallet;
        return sellerWallet;
      }),
      save: jest.fn(async (x) => x),
    };
    const txLedgerRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    const txNftRepo = {
      findOne: jest.fn(async () => nftInstance),
      save: jest.fn(async (x) => x),
    };
    const txListingRepo = {
      findOne: jest.fn(async () => listing),
      save: jest.fn(async (x) => x),
    };
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return txWalletRepo;
          if (entity === LedgerEntry) return txLedgerRepo;
          if (entity === NFTInstance) return txNftRepo;
          if (entity === MarketplaceListing) return txListingRepo;
          throw new Error("unexpected repository");
        },
      }),
    );

    const result = await service.purchaseNFTListing("g1", "0xbuyer", "l1");
    expect((result as { status: string }).status).toBe("sold");
    expect(nftInstance.owner).toBe(buyerPlayer);
    expect(listing.status).toBe("sold");
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "spend", amount: "10" }),
    );
    expect(txLedgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "earn", amount: "10" }),
    );
  });

  it("purchaseNFTListing throws 404 when listing not found", async () => {
    mockResolvePlayer({ id: "gp-buyer" }, { id: "w-buyer", balance: "100" });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return walletRepo;
          if (entity === LedgerEntry) return ledgerRepo;
          if (entity === NFTInstance) return nftInstanceRepo;
          if (entity === MarketplaceListing) {
            return {
              findOne: jest.fn(async () => null),
              save: jest.fn(),
            };
          }
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.purchaseNFTListing("g1", "0xbuyer", "l404"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Listing not found or no longer active",
    });
  });

  it("purchaseNFTListing throws 400 when buyer is also the seller", async () => {
    const player = { id: "gp1" };
    mockResolvePlayer(player, { id: "w-buyer", balance: "100" });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return walletRepo;
          if (entity === LedgerEntry) return ledgerRepo;
          if (entity === NFTInstance) return nftInstanceRepo;
          if (entity === MarketplaceListing) {
            return {
              findOne: jest.fn(async () => ({
                id: "l1",
                status: "active",
                askPrice: "10",
                seller: { id: "gp1" },
                nftInstance: { id: "n1" },
              })),
              save: jest.fn(),
            };
          }
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.purchaseNFTListing("g1", "0xbuyer", "l1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot purchase your own listing",
    });
  });

  it("purchaseNFTListing throws 402 when buyer has insufficient balance", async () => {
    mockResolvePlayer({ id: "gp-buyer" }, { id: "w-buyer", balance: "5" });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) {
            return {
              findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
                where.id === "w-buyer" ? { id: "w-buyer", balance: "5" } : null,
              ),
            };
          }
          if (entity === LedgerEntry) return ledgerRepo;
          if (entity === NFTInstance) return nftInstanceRepo;
          if (entity === MarketplaceListing) {
            return {
              findOne: jest.fn(async () => ({
                id: "l1",
                status: "active",
                askPrice: "10",
                seller: { id: "gp-seller" },
                nftInstance: { id: "n1" },
              })),
              save: jest.fn(),
            };
          }
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.purchaseNFTListing("g1", "0xbuyer", "l1"),
    ).rejects.toMatchObject({ statusCode: 402 });
  });

  it("purchaseNFTListing throws 404 when seller wallet is missing", async () => {
    mockResolvePlayer({ id: "gp-buyer" }, { id: "w-buyer", balance: "100" });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) {
            return {
              findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
                where.id === "w-buyer" ? { id: "w-buyer", balance: "100" } : null,
              ),
              save: jest.fn(async (x) => x),
            };
          }
          if (entity === LedgerEntry) return ledgerRepo;
          if (entity === NFTInstance) return nftInstanceRepo;
          if (entity === MarketplaceListing) {
            return {
              findOne: jest.fn(async () => ({
                id: "l1",
                status: "active",
                askPrice: "10",
                seller: { id: "gp-seller" },
                nftInstance: { id: "n1" },
              })),
              save: jest.fn(),
            };
          }
          throw new Error("unexpected repository");
        },
      }),
    );

    await expect(
      service.purchaseNFTListing("g1", "0xbuyer", "l1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Seller wallet not found",
    });
  });

  it("purchaseNFTListing returns sold listing for replay by same buyer", async () => {
    const buyerPlayer = { id: "gp-buyer" };
    mockResolvePlayer(buyerPlayer, { id: "w-buyer", balance: "100" });
    dataSource.transaction.mockImplementation(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === GameWallet) return walletRepo;
          if (entity === LedgerEntry) return ledgerRepo;
          if (entity === NFTInstance) return nftInstanceRepo;
          if (entity === MarketplaceListing) {
            return {
              findOne: jest.fn(async () => ({
                id: "l1",
                status: "sold",
                askPrice: "10",
                seller: { id: "gp-seller" },
                buyer: { id: "gp-buyer" },
                nftInstance: { id: "n1", owner: { id: "gp-buyer" } },
              })),
              save: jest.fn(),
            };
          }
          throw new Error("unexpected repository");
        },
      }),
    );

    const result = await service.purchaseNFTListing("g1", "0xbuyer", "l1");

    expect((result as { status: string }).status).toBe("sold");
  });
});
