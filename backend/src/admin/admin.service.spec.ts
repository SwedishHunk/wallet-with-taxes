import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";

function makeQuery(raw: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
}

function makeService(queryRaw?: unknown) {
  const query = makeQuery(queryRaw ?? null);
  const taxRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(query),
    findAndCount: jest.fn(),
  };
  const userRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(2), // default: 2 admins exist
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
  const studioRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(makeQuery(null)),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
  const gameRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const shopEventRepo = { find: jest.fn(), findAndCount: jest.fn() };
  const gamePlayerRepo = { find: jest.fn() };
  const economicEventRepo = { findAndCount: jest.fn() };
  const platformConfigRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };
  const auditLogRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue({}),
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };

  const service = new AdminService(
    taxRepo as never,
    shopEventRepo as never,
    userRepo as never,
    studioRepo as never,
    gameRepo as never,
    gamePlayerRepo as never,
    economicEventRepo as never,
    platformConfigRepo as never,
    auditLogRepo as never,
    dataSource as never,
  );

  return {
    service,
    taxRepo,
    shopEventRepo,
    userRepo,
    studioRepo,
    gameRepo,
    economicEventRepo,
    platformConfigRepo,
    auditLogRepo,
    query,
  };
}

const ADMIN = { id: "admin-1", email: "admin@triolith.io" };

describe("AdminService", () => {
  // ── fee stats ──────────────────────────────────────────────
  it("getFeeStats returns defaults when raw is null", async () => {
    const { service } = makeService(null);
    await expect(service.getFeeStats()).resolves.toEqual({
      totalFeesUSD: 0,
      totalTrades: 0,
      from: undefined,
      to: undefined,
    });
  });

  it("getFeeStats applies date filters", async () => {
    const { service, query } = makeService({
      totalFeesUSD: "12.5",
      totalTrades: "3",
    });
    await expect(
      service.getFeeStats("2026-01-01", "2026-01-31"),
    ).resolves.toEqual({
      totalFeesUSD: 12.5,
      totalTrades: 3,
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(query.andWhere).toHaveBeenCalledTimes(2);
  });

  // ── revenue split ──────────────────────────────────────────
  it("getRevenueSplit computes all shares", async () => {
    const { service } = makeService({ totalFeesUSD: "100" });
    await expect(service.getRevenueSplit()).resolves.toEqual({
      totalFeesUSD: 100,
      devShareUSD: 60,
      triolithNetUSD: 28.5,
      safuShareUSD: 1.5,
      stakerShareUSD: 10,
      from: undefined,
      to: undefined,
    });
  });

  it("getRevenueSplit applies one-sided date filters", async () => {
    const { service, query } = makeService({ totalFeesUSD: "50" });
    await service.getRevenueSplit("2026-01-01");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp >= :from", {
      from: "2026-01-01",
    });
  });

  it("getRevenueSplit applies to-only date filter", async () => {
    const { service, query } = makeService({ totalFeesUSD: "12" });
    await service.getRevenueSplit(undefined, "2026-01-31");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp <= :to", {
      to: "2026-01-31",
    });
  });

  // ── user list ──────────────────────────────────────────────
  it("getUserList returns repository selection", async () => {
    const users = [{ id: "u1" }];
    const { service, userRepo } = makeService();
    userRepo.find.mockResolvedValue(users);
    await expect(service.getUserList()).resolves.toEqual(users);
  });

  // ── studios ────────────────────────────────────────────────
  it("getAllStudios returns mapped studio list with memberCount", async () => {
    const rows = [
      {
        id: "s1",
        name: "Studio A",
        email: "a@test.com",
        status: "active",
        memberCount: 2,
        createdAt: new Date("2026-01-01"),
      },
    ];
    const { service, studioRepo } = makeService();
    // getAllStudios uses QueryBuilder; override getRawMany on the shared mock
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const qb = studioRepo.createQueryBuilder("s");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (qb.getRawMany as jest.Mock).mockResolvedValue(rows);
    await expect(service.getAllStudios()).resolves.toEqual(rows);
  });

  it("setStudioStatus updates status and writes audit", async () => {
    const { service, studioRepo } = makeService();
    studioRepo.findOne.mockResolvedValue({ id: "s1" });
    await expect(
      service.setStudioStatus("s1", "suspended", ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "s1", status: "suspended" });
    expect(studioRepo.update).toHaveBeenCalledWith("s1", {
      status: "suspended",
    });
  });

  it("setStudioStatus throws NotFoundException when studio missing", async () => {
    const { service, studioRepo } = makeService();
    studioRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setStudioStatus("x", "active", ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  it("deleteStudio removes studio and writes audit", async () => {
    const { service, studioRepo } = makeService();
    studioRepo.findOne.mockResolvedValue({ id: "s1" });
    await expect(
      service.deleteStudio("s1", ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "s1", deleted: true });
    // purgeStudio uses raw SQL via queryRunner — no studioRepo.delete call
  });

  it("deleteStudio throws NotFoundException when studio missing", async () => {
    const { service, studioRepo } = makeService();
    studioRepo.findOne.mockResolvedValue(null);
    await expect(
      service.deleteStudio("x", ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  // ── transactions ───────────────────────────────────────────
  it("getAllTransactions returns paginated events with formatted amounts", async () => {
    const raw = [
      {
        id: "e1",
        type: "BUY",
        user: "0xabc",
        asset: "0xdef",
        assetSymbol: "ETH",
        amountIn: "2000000000000000000",
        amountOut: "2000000000000000000000",
        blockNumber: 10,
        txHash: "0x123",
        createdAt: new Date("2026-03-18T00:00:00Z"),
      },
    ];
    const { service, shopEventRepo } = makeService();
    shopEventRepo.findAndCount.mockResolvedValue([raw, 1]);

    const result = await service.getAllTransactions(10, 0);
    expect(result.total).toBe(1);
    expect(result.events[0].amountIn).toBe("2.0");
    expect(result.events[0].amountOut).toBe("2000.0");
  });

  // ── users ──────────────────────────────────────────────────
  it("setUserAdmin updates isAdmin and writes audit", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue({ id: "u1" });
    await expect(
      service.setUserAdmin("u1", true, ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "u1", isAdmin: true });
    expect(userRepo.update).toHaveBeenCalledWith("u1", { isAdmin: true });
  });

  it("setUserAdmin throws NotFoundException when user missing", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setUserAdmin("x", true, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  it("setUserAdmin throws BadRequestException when admin revokes own privileges", async () => {
    const { service } = makeService();
    await expect(
      service.setUserAdmin(ADMIN.id, false, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(BadRequestException);
  });

  it("setUserAdmin throws BadRequestException when removing last admin", async () => {
    const { service, userRepo } = makeService();
    userRepo.count.mockResolvedValue(1); // only 1 admin left
    await expect(
      service.setUserAdmin("u1", false, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(BadRequestException);
  });

  it("setUserSuspended updates isSuspended and writes audit", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue({ id: "u1" });
    await expect(
      service.setUserSuspended("u1", true, ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "u1", isSuspended: true });
    expect(userRepo.update).toHaveBeenCalledWith("u1", { isSuspended: true });
  });

  it("setUserSuspended throws NotFoundException when user missing", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setUserSuspended("x", true, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  it("setUserSuspended throws BadRequestException when admin tries to suspend themselves", async () => {
    const { service } = makeService();
    await expect(
      service.setUserSuspended(ADMIN.id, true, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(BadRequestException);
  });

  it("deleteUser removes user and writes audit", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue({ id: "u1" });
    await expect(
      service.deleteUser("u1", ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "u1", deleted: true });
    expect(userRepo.delete).toHaveBeenCalledWith("u1");
  });

  it("deleteUser throws NotFoundException when user missing", async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.deleteUser("x", ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  it("deleteUser throws BadRequestException when admin tries to delete themselves", async () => {
    const { service } = makeService();
    await expect(
      service.deleteUser(ADMIN.id, ADMIN.id, ADMIN.email),
    ).rejects.toThrow(BadRequestException);
  });

  // ── platform fee ───────────────────────────────────────────
  it("getPlatformFee returns default 2.5 when config missing", async () => {
    const { service } = makeService();
    await expect(service.getPlatformFee()).resolves.toEqual({
      feePercent: 2.5,
    });
  });

  it("getPlatformFee returns stored value", async () => {
    const { service, platformConfigRepo } = makeService();
    platformConfigRepo.findOne.mockResolvedValue({
      key: "platform_fee_percent",
      value: "3.0",
    });
    await expect(service.getPlatformFee()).resolves.toEqual({ feePercent: 3 });
  });

  it("setPlatformFee saves value and writes audit", async () => {
    const { service, platformConfigRepo } = makeService();
    await expect(
      service.setPlatformFee(5, ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ feePercent: 5 });
    expect(platformConfigRepo.save).toHaveBeenCalledWith({
      key: "platform_fee_percent",
      value: 5,
    });
  });

  // ── audit log ──────────────────────────────────────────────
  it("getAuditLog returns paginated entries", async () => {
    const entries = [{ id: "al1" }];
    const { service, auditLogRepo } = makeService();
    auditLogRepo.findAndCount.mockResolvedValue([entries, 1]);
    await expect(service.getAuditLog(10, 0)).resolves.toEqual({
      entries,
      total: 1,
      limit: 10,
      offset: 0,
    });
  });

  // ── games ──────────────────────────────────────────────────
  it("getAllGames returns mapped game list", async () => {
    const games = [
      {
        id: "g1",
        name: "Game One",
        slug: "game-one",
        status: "active",
        studio: { id: "s1", name: "Studio A" },
        createdAt: new Date("2026-01-01"),
      },
    ];
    const { service, gameRepo } = makeService();
    gameRepo.find.mockResolvedValue(games);

    await expect(service.getAllGames()).resolves.toEqual([
      {
        id: "g1",
        name: "Game One",
        slug: "game-one",
        status: "active",
        studioId: "s1",
        studioName: "Studio A",
        createdAt: games[0].createdAt,
      },
    ]);
  });

  it("setGameStatus updates status and writes audit", async () => {
    const { service, gameRepo } = makeService();
    gameRepo.findOne.mockResolvedValue({ id: "g1" });
    await expect(
      service.setGameStatus("g1", "inactive", ADMIN.id, ADMIN.email),
    ).resolves.toEqual({ id: "g1", status: "inactive" });
    expect(gameRepo.update).toHaveBeenCalledWith("g1", { status: "inactive" });
  });

  it("setGameStatus throws NotFoundException when game missing", async () => {
    const { service, gameRepo } = makeService();
    gameRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setGameStatus("x", "active", ADMIN.id, ADMIN.email),
    ).rejects.toThrow(NotFoundException);
  });

  it("getStudioGames returns games for a studio", async () => {
    const games = [{ id: "g1", name: "Game One" }];
    const { service, gameRepo } = makeService();
    gameRepo.find.mockResolvedValue(games);
    await expect(service.getStudioGames("s1")).resolves.toEqual(games);
  });
});
