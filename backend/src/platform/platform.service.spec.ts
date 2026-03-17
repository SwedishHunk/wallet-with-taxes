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

type Repo = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
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
    );
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
      }) // global conflict -> build scoped slug
      .mockResolvedValueOnce({ id: "g-scoped", slug: "game-studio-a" }) // scoped slug taken -> enter while body
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
});
