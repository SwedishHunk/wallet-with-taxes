/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as bcrypt from "bcryptjs";
import { UsersService } from "./users.service";
import { AppException } from "../common/exceptions/app-exception";
import { BadRequestException } from "@nestjs/common";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { ethers } from "ethers";

type Repo = {
  findOne: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update?: jest.Mock;
};

type MockQueryRunner = {
  connect: jest.Mock;
  startTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  release: jest.Mock;
  manager: { create: jest.Mock; save: jest.Mock };
};

describe("UsersService", () => {
  let userRepo: Repo;
  let studioRepo: Repo;
  let studioMemberRepo: Repo;
  let studioMemberService: {
    createBootstrapOwner: jest.Mock;
    maskToPermissionStrings: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let queryRunner: MockQueryRunner;
  let dataSource: { createQueryRunner: jest.Mock };
  let service: UsersService;
  const originalEnv = {
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENCRYPTION_IV: process.env.ENCRYPTION_IV,
    JWT_SECRET: process.env.JWT_SECRET,
    RPC_URL: process.env.RPC_URL,
    FACTORY_ADDRESS: process.env.FACTORY_ADDRESS,
    DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
  };

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? "u1", ...x })),
      update: jest.fn().mockResolvedValue({}),
    };
    studioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? "s1", ...x })),
    };
    studioMemberRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    studioMemberService = {
      createBootstrapOwner: jest.fn(),
      maskToPermissionStrings: jest.fn().mockReturnValue(["ManageMembers"]),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("jwt-token"),
    };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn((_, data: Record<string, unknown>) => ({ ...data })),
        save: jest.fn(async (x: Record<string, unknown>) => {
          // User has passwordHash; Studio has name/email but no passwordHash
          if ("passwordHash" in x) return { id: "u1", ...x };
          return { id: "s1", ...x };
        }),
      },
    };
    dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
    service = new UsersService(
      userRepo as never,
      studioRepo as never,
      studioMemberRepo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      studioMemberService as never,
      jwtService as never,
      dataSource as never,
      {
        encrypt: jest.fn((x: string) => x),
        decrypt: jest.fn((x: string) => x),
      } as never,
    );

    process.env.ENCRYPTION_KEY = "12345678901234567890123456789012";
    process.env.ENCRYPTION_IV = "1234567890123456";
    process.env.JWT_SECRET = "test-secret";
    delete process.env.RPC_URL;
    delete process.env.FACTORY_ADDRESS;
    delete process.env.DEPLOYER_PRIVATE_KEY;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    Object.entries(originalEnv).forEach(([k, v]) => {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    });
  });

  it("signup validates email", async () => {
    await expect(
      service.signup("bad-email", "pw", undefined, true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("signup rejects existing user", async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: "u-existing" });
    await expect(
      service.signup("user@test.com", "pw", undefined, true),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
    });
  });

  it("signup creates user, studio, owner membership and token", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    userRepo.findOne.mockResolvedValueOnce(null);
    userRepo.save.mockImplementationOnce(async (x) => ({ id: "u1", ...x }));
    studioRepo.save.mockImplementationOnce(async (x) => ({ id: "s1", ...x }));
    studioMemberService.createBootstrapOwner.mockResolvedValueOnce({
      id: "m1",
      role: "owner",
      isOwner: true,
      permissionsMask: 1n,
      gameAccessIds: [],
    });

    const result = await service.signup(
      "user@test.com",
      "pw",
      "My Studio",
      true,
    );

    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: "user@test.com",
        custodyMode: "custodial",
        kycStatus: "pending",
      }),
    );
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "My Studio",
        email: "user@test.com",
      }),
    );
    expect(jwtService.sign).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        token: "jwt-token",
        studio: expect.objectContaining({ studioId: "s1" }),
        member: expect.objectContaining({ memberId: "m1" }),
      }),
    );
  });

  it("login validates email format", async () => {
    await expect(service.login("bad-email", "pw")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("login rejects missing user", async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.login("user@test.com", "pw")).rejects.toMatchObject({
      statusCode: 401,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("login rejects wrong password", async () => {
    const passwordHash = await bcrypt.hash("correct", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
    });
    await expect(service.login("user@test.com", "wrong")).rejects.toMatchObject(
      {
        statusCode: 401,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      },
    );
  });

  it("login rejects suspended user", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      isSuspended: true,
    });

    await expect(service.login("user@test.com", "pw")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("login with studioId succeeds when membership exists", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      walletAddress: "0xwallet",
    });
    studioMemberRepo.findOne.mockResolvedValueOnce({
      studio: { id: "s1", status: "active" },
      role: "admin",
    });

    const result = await service.login("user@test.com", "pw", "s1");
    expect(result.user.studioId).toBe("s1");
  });

  it("login rejects suspended studio", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
    });
    studioMemberRepo.count.mockResolvedValueOnce(1);
    studioMemberRepo.find.mockResolvedValueOnce([
      { studio: { id: "s1", status: "suspended", name: "S1" }, role: "owner" },
    ]);

    await expect(service.login("user@test.com", "pw")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("login with studioId enforces membership", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
    });
    studioMemberRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.login("user@test.com", "pw", "s1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ERROR_MESSAGES.NOT_STUDIO_MEMBER,
    });
  });

  it("login succeeds with existing membership", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      walletAddress: "0xwallet",
      custodyMode: "custodial",
      kycStatus: "pending",
    });
    studioMemberRepo.count.mockResolvedValueOnce(1);
    studioMemberRepo.find.mockResolvedValueOnce([
      { studio: { id: "s1", status: "active", name: "S1" }, role: "owner" },
    ]);

    const result = await service.login("user@test.com", "pw");
    expect(result).toEqual(
      expect.objectContaining({
        token: "jwt-token",
        studios: expect.arrayContaining([
          expect.objectContaining({ id: "s1" }),
        ]),
      }),
    );
  });

  it("login auto-creates studio and bootstrap membership when user has none", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      walletAddress: "0xwallet",
      custodyMode: "custodial",
      kycStatus: "pending",
    });
    studioMemberRepo.count.mockResolvedValueOnce(0);
    studioRepo.findOne.mockResolvedValueOnce(null);
    studioRepo.save.mockImplementationOnce(async (x) => ({
      id: "s-new",
      ...x,
    }));
    studioMemberRepo.findOne.mockResolvedValueOnce(null);
    studioMemberService.createBootstrapOwner.mockResolvedValueOnce({
      id: "m-new",
      studio: { id: "s-new" },
      role: "owner",
    });
    studioMemberRepo.find.mockResolvedValueOnce([
      {
        studio: { id: "s-new", status: "active", name: "New Studio" },
        role: "owner",
      },
    ]);

    const result = await service.login("user@test.com", "pw");
    expect(result.studios![0].id).toBe("s-new");
    expect(studioRepo.create).toHaveBeenCalled();
    expect(studioMemberService.createBootstrapOwner).toHaveBeenCalled();
  });

  it("login uses existing studio and membership during auto-migration", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      walletAddress: "0xwallet",
      custodyMode: "custodial",
      kycStatus: "pending",
    });
    studioMemberRepo.count.mockResolvedValueOnce(0);
    studioRepo.findOne.mockResolvedValueOnce({ id: "s-existing" });
    studioMemberRepo.findOne.mockResolvedValueOnce({
      studio: { id: "s-existing" },
      role: "owner",
    });
    studioMemberRepo.find.mockResolvedValueOnce([
      {
        studio: { id: "s-existing", status: "active", name: "Existing Studio" },
        role: "owner",
      },
    ]);

    const result = await service.login("user@test.com", "pw");
    expect(result.studios![0].id).toBe("s-existing");
    expect(studioMemberService.createBootstrapOwner).not.toHaveBeenCalled();
  });

  it("login throws when no active studio is available", async () => {
    const passwordHash = await bcrypt.hash("pw", 4);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
      passwordHash,
      walletAddress: "0xwallet",
      custodyMode: "custodial",
      kycStatus: "pending",
    });
    studioMemberRepo.count.mockResolvedValueOnce(1);
    // All studios suspended — filter removes them all
    studioMemberRepo.find.mockResolvedValueOnce([
      {
        studio: { id: "s1", status: "suspended", name: "S1" },
        role: "owner",
      },
    ]);

    await expect(service.login("user@test.com", "pw")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("linkWallet rejects an unparseable signature", async () => {
    await expect(
      service.linkWallet("user@test.com", "0x" + "aa".repeat(20), "not-a-sig"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("linkWallet rejects mismatched wallet ownership signature", async () => {
    const wrongWallet = new ethers.Wallet("0x" + "cc".repeat(32));
    const sig = await wrongWallet.signMessage(
      "Link wallet to Triolith: user@test.com",
    );
    // Signature is valid but for a different address than supplied
    await expect(
      service.linkWallet(
        "user@test.com",
        "0x" + "dd".repeat(20), // wrong address
        sig,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("linkWallet throws when user does not exist", async () => {
    const testWallet = new ethers.Wallet("0x" + "bb".repeat(32));
    const sig = await testWallet.signMessage(
      "Link wallet to Triolith: missing@test.com",
    );
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.linkWallet("missing@test.com", testWallet.address, sig),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("linkWallet updates custody mode to self", async () => {
    const testWallet = new ethers.Wallet("0x" + "aa".repeat(32));
    const sig = await testWallet.signMessage(
      "Link wallet to Triolith: user@test.com",
    );
    const user = {
      id: "u1",
      email: "user@test.com",
      walletAddress: "0xold",
      custodyMode: "custodial",
      encryptedPrivateKey: "enc",
    };
    userRepo.findOne.mockResolvedValueOnce(user);

    await expect(
      service.linkWallet("user@test.com", testWallet.address, sig),
    ).resolves.toEqual({
      message: "Wallet linked successfully",
    });
    expect(user.walletAddress).toBe(testWallet.address);
    expect(user.custodyMode).toBe("self");
    expect(user.encryptedPrivateKey).toBeNull();
    expect(userRepo.save).toHaveBeenCalledWith(user);
  });

  it("findById returns null when user missing", async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findById("u1")).resolves.toBeNull();
  });

  it("findById enriches with studioId when membership exists", async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: "u1", email: "u@test.com" });
    studioMemberRepo.findOne.mockResolvedValueOnce({ studio: { id: "s1" } });
    await expect(service.findById("u1")).resolves.toEqual(
      expect.objectContaining({ id: "u1", studioId: "s1" }),
    );
  });

  it("getStudiosForUser maps memberships to studios with role", async () => {
    studioMemberRepo.find.mockResolvedValueOnce([
      { studio: { id: "s1", name: "A" }, role: "owner" },
    ]);
    await expect(service.getStudiosForUser("u1")).resolves.toEqual([
      { id: "s1", name: "A", role: "owner" },
    ]);
  });

  it("getMemberSession enforces membership and maps response", async () => {
    studioMemberRepo.findOne.mockResolvedValueOnce({
      id: "m1",
      user: { id: "u1", email: "u@test.com" },
      studio: { id: "s1" },
      isOwner: true,
      role: "owner",
      permissionsMask: 1n,
      gameAccessIds: ["g1"],
    });

    await expect(service.getMemberSession("u1", "s1")).resolves.toEqual({
      memberId: "m1",
      userId: "u1",
      studioId: "s1",
      email: "u@test.com",
      isOwner: true,
      role: "owner",
      permissions: ["ManageMembers"],
      gameAccessIds: ["g1"],
    });
  });

  it("getMemberSession throws when membership missing", async () => {
    studioMemberRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.getMemberSession("u1", "s1")).rejects.toMatchObject({
      statusCode: 404,
      message: ERROR_MESSAGES.NOT_STUDIO_MEMBER,
    });
  });

  it("updateTin updates taxIdentificationNumber for existing user", async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: "u1" });
    const result = await service.updateTin("u1", "19900101-1234");
    expect(result).toEqual({ updated: true });
    expect(userRepo.update).toHaveBeenCalledWith("u1", {
      taxIdentificationNumber: "19900101-1234",
    });
  });

  it("updateTin throws 404 when user not found", async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.updateTin("u1", "19900101-1234"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("signup handles on-chain wallet failure branch", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.RPC_URL = "http://localhost:8545";
    process.env.FACTORY_ADDRESS = "0x0000000000000000000000000000000000000001";
    process.env.DEPLOYER_PRIVATE_KEY =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    userRepo.findOne.mockResolvedValueOnce(null);
    jest
      .spyOn(ethers, "JsonRpcProvider")
      .mockImplementation(() => ({}) as never);
    jest.spyOn(ethers, "Contract").mockImplementation(
      () =>
        ({
          createWallet: jest.fn(async () => ({
            wait: jest.fn(async () => ({ status: 0 })),
          })),
        }) as never,
    );
    studioMemberService.createBootstrapOwner.mockResolvedValueOnce({
      id: "m1",
      role: "owner",
      isOwner: true,
      permissionsMask: 1n,
      gameAccessIds: [],
    });

    await service.signup("chain@test.com", "pw", undefined, true);
  });

  // ── loginByWallet ───────────────────────────────────────────────────────────

  describe("loginByWallet", () => {
    const testWallet = new ethers.Wallet("0x" + "ab".repeat(32));
    const normalizedAddress = testWallet.address.toLowerCase();

    function makeMessage(offsetMs = 0) {
      const ts = Date.now() + offsetMs;
      return `Triolith Portal Login\nWallet: ${normalizedAddress}\nTimestamp: ${ts}`;
    }

    it("rejects an invalid wallet address", async () => {
      await expect(
        service.loginByWallet("not-an-address", "msg", "sig"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects a message without a Timestamp field", async () => {
      await expect(
        service.loginByWallet(normalizedAddress, "No timestamp here", "sig"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects an expired challenge (timestamp > 5 min ago)", async () => {
      const oldMsg = makeMessage(-6 * 60 * 1000); // 6 min ago
      const sig = await testWallet.signMessage(oldMsg);
      await expect(
        service.loginByWallet(normalizedAddress, oldMsg, sig),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("rejects a mismatched signature", async () => {
      const otherWallet = new ethers.Wallet("0x" + "cd".repeat(32));
      const msg = makeMessage();
      const sig = await otherWallet.signMessage(msg); // signed by a different key
      await expect(
        service.loginByWallet(normalizedAddress, msg, sig),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("returns a token for an existing user", async () => {
      const msg = makeMessage();
      const sig = await testWallet.signMessage(msg);
      userRepo.findOne.mockResolvedValueOnce({
        id: "u-wallet",
        email: `${normalizedAddress}@wallet.triolith`,
        walletAddress: normalizedAddress,
        isAdmin: false,
        isSuspended: false,
      });
      const result = await service.loginByWallet(normalizedAddress, msg, sig);
      expect(result.token).toBe("jwt-token");
      expect(result.walletAddress).toBe(normalizedAddress);
      expect(userRepo.save).not.toHaveBeenCalled(); // no new user created
    });

    it("creates a new user when wallet is not yet registered", async () => {
      const msg = makeMessage();
      const sig = await testWallet.signMessage(msg);
      userRepo.findOne.mockResolvedValueOnce(null); // no existing user
      userRepo.save.mockResolvedValueOnce({
        id: "u-new",
        email: `${normalizedAddress}@wallet.triolith`,
        walletAddress: normalizedAddress,
        isAdmin: false,
        isSuspended: false,
      });
      const result = await service.loginByWallet(normalizedAddress, msg, sig);
      expect(result.token).toBe("jwt-token");
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: `${normalizedAddress}@wallet.triolith`,
          custodyMode: "self",
          walletAddress: normalizedAddress,
        }),
      );
      expect(userRepo.save).toHaveBeenCalled();
    });

    it("throws 403 when the wallet user is suspended", async () => {
      const msg = makeMessage();
      const sig = await testWallet.signMessage(msg);
      userRepo.findOne.mockResolvedValueOnce({
        id: "u-suspended",
        walletAddress: normalizedAddress,
        isAdmin: false,
        isSuspended: true,
      });
      await expect(
        service.loginByWallet(normalizedAddress, msg, sig),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
