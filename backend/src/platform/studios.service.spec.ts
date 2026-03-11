/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { StudiosService } from "./studios.service";
import { StudioRole } from "./entities/studio-member.entity";

type Repo = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

describe("StudiosService", () => {
  let studioRepo: Repo;
  let userRepo: Repo;
  let memberRepo: Repo;
  let studioMemberService: {
    hasPermission: jest.Mock;
    maskToPermissionStrings: jest.Mock;
  };
  let service: StudiosService;
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalIv = process.env.ENCRYPTION_IV;

  beforeEach(() => {
    studioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: "u-new", ...x })),
    };
    memberRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => ({ id: "m-new", ...x })),
      save: jest.fn(async (x) => x),
    };
    studioMemberService = {
      hasPermission: jest.fn(),
      maskToPermissionStrings: jest.fn().mockReturnValue(["ManageMembers"]),
    };
    service = new StudiosService(
      studioRepo as never,
      userRepo as never,
      memberRepo as never,
      studioMemberService as never,
    );

    process.env.ENCRYPTION_KEY = "12345678901234567890123456789012";
    process.env.ENCRYPTION_IV = "1234567890123456";
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
    if (originalIv === undefined) {
      delete process.env.ENCRYPTION_IV;
    } else {
      process.env.ENCRYPTION_IV = originalIv;
    }
  });

  it("getStudioMembers rejects non-member actor", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.getStudioMembers("s1", "actor"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("getStudioMembers maps response fields", async () => {
    memberRepo.findOne.mockResolvedValueOnce({ id: "actor" });
    memberRepo.find.mockResolvedValueOnce([
      {
        id: "m1",
        user: { id: "u1", email: "u1@test.com" },
        isOwner: false,
        role: StudioRole.ADMIN,
        permissionsMask: 3n,
        gameAccessIds: ["g1"],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const rows = await service.getStudioMembers("s1", "actor");
    expect(rows).toEqual([
      expect.objectContaining({
        id: "m1",
        userId: "u1",
        email: "u1@test.com",
        permissions: ["ManageMembers"],
        gameAccessIds: ["g1"],
      }),
    ]);
    expect(studioMemberService.maskToPermissionStrings).toHaveBeenCalledWith(
      3n,
    );
  });

  it("createMember rejects actor without membership", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createMember("s1", "actor", {
        email: "user@test.com",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createMember rejects actor without ManageMembers permission", async () => {
    memberRepo.findOne.mockResolvedValueOnce({
      isOwner: false,
      user: { id: "actor" },
      studio: { id: "s1" },
    });
    studioMemberService.hasPermission.mockReturnValueOnce(false);

    await expect(
      service.createMember("s1", "actor", {
        email: "user@test.com",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createMember validates email format", async () => {
    memberRepo.findOne.mockResolvedValueOnce({
      isOwner: true,
      user: { id: "actor" },
      studio: { id: "s1" },
    });

    await expect(
      service.createMember("s1", "actor", {
        email: "not-an-email",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createMember rejects duplicate studio membership", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce({
        isOwner: true,
        user: { id: "actor" },
        studio: { id: "s1" },
      })
      .mockResolvedValueOnce({ id: "existing-member" });
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
    });

    await expect(
      service.createMember("s1", "actor", {
        email: "user@test.com",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createMember rejects unknown studio", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce({
        isOwner: true,
        user: { id: "actor" },
        studio: { id: "s1" },
      })
      .mockResolvedValueOnce(null);
    userRepo.findOne.mockResolvedValueOnce({
      id: "u1",
      email: "user@test.com",
    });
    studioRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createMember("s1", "actor", {
        email: "user@test.com",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createMember creates user and membership when user is new", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce({
        isOwner: true,
        user: { id: "actor" },
        studio: { id: "s1" },
      })
      .mockResolvedValueOnce(null);
    userRepo.findOne.mockResolvedValueOnce(null);
    studioRepo.findOne.mockResolvedValueOnce({ id: "s1" });
    const result = await service.createMember("s1", "actor", {
      email: "new@test.com",
      role: "admin",
      permissions: ["ManageMembers", "MintNFT"],
    });

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@test.com",
        custodyMode: "custodial",
        kycStatus: "pending",
      }),
    );
    expect(userRepo.create.mock.calls[0][0].passwordHash).toEqual(
      expect.any(String),
    );
    expect(userRepo.create.mock.calls[0][0].walletAddress).toMatch(
      /^0x[a-fA-F0-9]{40}$/,
    );
    expect(memberRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "admin",
        isOwner: false,
        gameAccessIds: [],
      }),
    );
    expect(typeof memberRepo.create.mock.calls[0][0].permissionsMask).toBe(
      "bigint",
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: "m-new",
        email: "new@test.com",
        role: "admin",
        permissions: ["ManageMembers"],
      }),
    );
  });
});
