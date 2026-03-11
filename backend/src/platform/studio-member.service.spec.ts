/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { StudioMemberService } from "./studio-member.service";
import {
  PermissionBitMask,
  StudioMember,
  StudioRole,
} from "./entities/studio-member.entity";

type MockMemberRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  createQueryBuilder: jest.Mock;
};

type MockStudioRepo = {
  findOne: jest.Mock;
};

function member(partial: Partial<StudioMember>): StudioMember {
  return {
    id: "m1",
    studio: { id: "s1" } as never,
    user: { id: "u1" } as never,
    isOwner: false,
    role: StudioRole.MEMBER,
    permissionsMask: 0n,
    gameAccessIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("StudioMemberService", () => {
  let memberRepo: MockMemberRepo;
  let studioRepo: MockStudioRepo;
  let service: StudioMemberService;

  beforeEach(() => {
    memberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      remove: jest.fn(async () => undefined),
      createQueryBuilder: jest.fn(),
    };
    studioRepo = {
      findOne: jest.fn(),
    };
    service = new StudioMemberService(memberRepo as never, studioRepo as never);
  });

  it("hasPermission checks bitwise permission mask", () => {
    const m = member({
      permissionsMask:
        PermissionBitMask.ManageMembers | PermissionBitMask.ManageGames,
    });

    expect(service.hasPermission(m, PermissionBitMask.ManageMembers)).toBe(
      true,
    );
    expect(service.hasPermission(m, PermissionBitMask.MintNFT)).toBe(false);
  });

  it("hasGameAccess checks game id inclusion", () => {
    const m = member({ gameAccessIds: ["g1", "g2"] });
    expect(service.hasGameAccess(m, "g2")).toBe(true);
    expect(service.hasGameAccess(m, "g9")).toBe(false);
  });

  it("flagsToMask and maskToFlags are consistent", () => {
    const mask = service.flagsToMask({
      ManageMembers: true,
      ManageGames: true,
      ManageSettings: false,
      MintNFT: true,
      MakeTransactions: false,
    });

    expect(mask).toBe(
      PermissionBitMask.ManageMembers |
        PermissionBitMask.ManageGames |
        PermissionBitMask.MintNFT,
    );
    expect(service.maskToFlags(mask)).toEqual({
      ManageMembers: true,
      ManageGames: true,
      ManageSettings: false,
      MintNFT: true,
      MakeTransactions: false,
    });
  });

  it("maskToPermissionStrings returns readable permission names", () => {
    const mask =
      PermissionBitMask.ManageMembers | PermissionBitMask.MakeTransactions;
    expect(service.maskToPermissionStrings(mask)).toEqual([
      "ManageMembers",
      "MakeTransactions",
    ]);
  });

  it("createBootstrapOwner creates an owner with full permissions", async () => {
    const studio = { id: "s1" } as never;
    const user = { id: "u1" } as never;
    await service.createBootstrapOwner(studio, user);

    const createPayload = memberRepo.create.mock.calls[0][0];
    expect(createPayload.isOwner).toBe(true);
    expect(createPayload.role).toBe(StudioRole.OWNER);
    expect(createPayload.permissionsMask).toBe(
      PermissionBitMask.ManageMembers |
        PermissionBitMask.ManageGames |
        PermissionBitMask.ManageSettings |
        PermissionBitMask.MintNFT |
        PermissionBitMask.MakeTransactions,
    );
    expect(memberRepo.save).toHaveBeenCalled();
  });

  it("promoteToOwner requires actor to be owner", async () => {
    memberRepo.findOne.mockResolvedValueOnce(
      member({
        id: "actor",
        isOwner: false,
      }),
    );

    await expect(
      service.promoteToOwner("actor", "target"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("promoteToOwner upgrades member and grants full permissions", async () => {
    const actor = member({
      id: "actor",
      isOwner: true,
      studio: { id: "s1" } as never,
    });
    const target = member({
      id: "target",
      isOwner: false,
      studio: { id: "s1" } as never,
    });
    memberRepo.findOne
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(target);

    await service.promoteToOwner("actor", "target");

    expect(target.isOwner).toBe(true);
    expect(target.role).toBe(StudioRole.OWNER);
    expect(target.permissionsMask).toBe(
      PermissionBitMask.ManageMembers |
        PermissionBitMask.ManageGames |
        PermissionBitMask.ManageSettings |
        PermissionBitMask.MintNFT |
        PermissionBitMask.MakeTransactions,
    );
    expect(memberRepo.save).toHaveBeenCalledWith(target);
  });

  it("createMember rejects duplicates in same studio", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce({ id: "existing" });
    studioRepo.findOne.mockResolvedValueOnce({ id: "s1" });

    await expect(
      service.createMember("actor", "s1", { userId: "u9" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updateMember rejects owner target mutation", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(
        member({ id: "target", studio: { id: "s1" } as never, isOwner: true }),
      );

    await expect(
      service.updateMember("actor", "target", { role: StudioRole.ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("getMemberById throws not found for missing member", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.getMemberById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("getMemberById returns member when found", async () => {
    memberRepo.findOne.mockResolvedValueOnce(member({ id: "m-ok" }));
    await expect(service.getMemberById("m-ok")).resolves.toEqual(
      expect.objectContaining({ id: "m-ok" }),
    );
  });

  it("getStudioOwners and getStudioMembers query repository", async () => {
    memberRepo.find
      .mockResolvedValueOnce([{ id: "o1" }])
      .mockResolvedValueOnce([{ id: "m1" }]);
    await expect(service.getStudioOwners("s1")).resolves.toEqual([
      { id: "o1" },
    ]);
    await expect(service.getStudioMembers("s1")).resolves.toEqual([
      { id: "m1" },
    ]);
  });

  it("createMember throws when actor does not exist", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.createMember("actor-missing", "s1", { userId: "u2" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createMember throws when actor cannot manage members", async () => {
    memberRepo.findOne.mockResolvedValueOnce(
      member({
        id: "actor",
        isOwner: false,
        permissionsMask: 0n,
      }),
    );
    await expect(
      service.createMember("actor", "s1", { userId: "u2" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createMember throws when studio does not exist", async () => {
    memberRepo.findOne.mockResolvedValueOnce(
      member({
        id: "actor",
        permissionsMask: PermissionBitMask.ManageMembers,
      }),
    );
    studioRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.createMember("actor", "s1", { userId: "u2" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createMember blocks cross-studio actor", async () => {
    memberRepo.findOne.mockResolvedValueOnce(
      member({
        id: "actor",
        studio: { id: "s-other" } as never,
        permissionsMask: PermissionBitMask.ManageMembers,
      }),
    );

    await expect(
      service.createMember("actor", "s1", { userId: "u2" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createMember succeeds with defaults", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(null);
    studioRepo.findOne.mockResolvedValueOnce({ id: "s1" });

    const created = await service.createMember("actor", "s1", { userId: "u2" });
    expect(created).toEqual(
      expect.objectContaining({
        isOwner: false,
        role: StudioRole.MEMBER,
      }),
    );
    expect(memberRepo.save).toHaveBeenCalled();
  });

  it("updateMember throws when actor or target is missing", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.updateMember("missing", "target", {}),
    ).rejects.toBeInstanceOf(NotFoundException);

    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(null);
    await expect(
      service.updateMember("actor", "missing-target", {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updateMember applies changes for non-owner target", async () => {
    const target = member({ id: "target", studio: { id: "s1" } as never });
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(target);

    await service.updateMember("actor", "target", {
      role: StudioRole.ADMIN,
      permissionsMask: PermissionBitMask.ManageGames,
      gameAccessIds: ["g1"],
    });
    expect(target.role).toBe(StudioRole.ADMIN);
    expect(target.permissionsMask).toBe(PermissionBitMask.ManageGames);
    expect(target.gameAccessIds).toEqual(["g1"]);
  });

  it("updateMember blocks cross-studio updates", async () => {
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(
        member({
          id: "target",
          studio: { id: "s2" } as never,
          isOwner: false,
        }),
      );

    await expect(
      service.updateMember("actor", "target", { role: StudioRole.ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("deleteMember throws for missing actor or target", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.deleteMember("nope", "m2")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(null);
    await expect(
      service.deleteMember("actor", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deleteMember blocks when operation would remove last owner", async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    memberRepo.createQueryBuilder.mockReturnValueOnce(qb);
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(
        member({
          id: "target",
          studio: { id: "s1" } as never,
          isOwner: false,
        }),
      );

    await expect(
      service.deleteMember("actor", "target"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deleteMember removes target when owner invariant is satisfied", async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    memberRepo.createQueryBuilder.mockReturnValueOnce(qb);
    const target = member({
      id: "target",
      studio: { id: "s1" } as never,
      isOwner: false,
    });
    memberRepo.findOne
      .mockResolvedValueOnce(
        member({
          id: "actor",
          studio: { id: "s1" } as never,
          permissionsMask: PermissionBitMask.ManageMembers,
        }),
      )
      .mockResolvedValueOnce(target);

    await service.deleteMember("actor", "target");
    expect(memberRepo.remove).toHaveBeenCalledWith(target);
  });

  it("promoteToOwner throws on missing actor/target or already-owner target", async () => {
    memberRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.promoteToOwner("missing", "target"),
    ).rejects.toBeInstanceOf(NotFoundException);

    memberRepo.findOne
      .mockResolvedValueOnce(member({ id: "actor", isOwner: true }))
      .mockResolvedValueOnce(null);
    await expect(
      service.promoteToOwner("actor", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);

    memberRepo.findOne
      .mockResolvedValueOnce(member({ id: "actor", isOwner: true }))
      .mockResolvedValueOnce(member({ id: "target", isOwner: true }));
    await expect(
      service.promoteToOwner("actor", "target"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
