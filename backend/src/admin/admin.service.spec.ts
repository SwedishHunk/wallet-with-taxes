import { AdminService } from "./admin.service";

function makeQuery(raw: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
}

function makeRepos(queryRaw?: unknown) {
  const query = makeQuery(queryRaw ?? null);
  return {
    taxRepo: { createQueryBuilder: jest.fn().mockReturnValue(query) },
    userRepo: { find: jest.fn() },
    studioRepo: { find: jest.fn(), findAndCount: jest.fn() },
    economicEventRepo: { findAndCount: jest.fn() },
    query,
  };
}

describe("AdminService", () => {
  it("getFeeStats returns defaults when raw is null", async () => {
    const { taxRepo, userRepo, studioRepo, economicEventRepo } = makeRepos(null);
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );

    await expect(service.getFeeStats()).resolves.toEqual({
      totalFeesUSD: 0,
      totalTrades: 0,
      from: undefined,
      to: undefined,
    });
  });

  it("getFeeStats applies date filters", async () => {
    const { taxRepo, userRepo, studioRepo, economicEventRepo, query } =
      makeRepos({ totalFeesUSD: "12.5", totalTrades: "3" });
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );

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

  it("getRevenueSplit computes all shares", async () => {
    const { taxRepo, userRepo, studioRepo, economicEventRepo } = makeRepos({
      totalFeesUSD: "100",
    });
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );

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
    const { taxRepo, userRepo, studioRepo, economicEventRepo, query } =
      makeRepos({ totalFeesUSD: "50" });
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );
    await service.getRevenueSplit("2026-01-01");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp >= :from", {
      from: "2026-01-01",
    });
  });

  it("getRevenueSplit applies to-only date filter", async () => {
    const { taxRepo, userRepo, studioRepo, economicEventRepo, query } =
      makeRepos({ totalFeesUSD: "12" });
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );
    await service.getRevenueSplit(undefined, "2026-01-31");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp <= :to", {
      to: "2026-01-31",
    });
  });

  it("getUserList returns repository selection", async () => {
    const users = [{ id: "u1" }];
    const taxRepo = { createQueryBuilder: jest.fn() };
    const userRepo = { find: jest.fn().mockResolvedValue(users) };
    const studioRepo = { find: jest.fn() };
    const economicEventRepo = { findAndCount: jest.fn() };
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );
    await expect(service.getUserList()).resolves.toEqual(users);
  });

  it("getAllStudios returns mapped studio list with memberCount", async () => {
    const studios = [
      {
        id: "s1",
        name: "Studio A",
        email: "a@test.com",
        status: "active",
        members: [{ id: "m1" }, { id: "m2" }],
        createdAt: new Date("2026-01-01"),
      },
    ];
    const taxRepo = { createQueryBuilder: jest.fn() };
    const userRepo = { find: jest.fn() };
    const studioRepo = { find: jest.fn().mockResolvedValue(studios) };
    const economicEventRepo = { findAndCount: jest.fn() };
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );

    await expect(service.getAllStudios()).resolves.toEqual([
      {
        id: "s1",
        name: "Studio A",
        email: "a@test.com",
        status: "active",
        memberCount: 2,
        createdAt: studios[0].createdAt,
      },
    ]);
  });

  it("getAllTransactions returns paginated events", async () => {
    const events = [{ id: "e1" }];
    const taxRepo = { createQueryBuilder: jest.fn() };
    const userRepo = { find: jest.fn() };
    const studioRepo = { find: jest.fn() };
    const economicEventRepo = {
      findAndCount: jest.fn().mockResolvedValue([events, 1]),
    };
    const service = new AdminService(
      taxRepo as never,
      userRepo as never,
      studioRepo as never,
      economicEventRepo as never,
    );

    await expect(service.getAllTransactions(10, 0)).resolves.toEqual({
      events,
      total: 1,
      limit: 10,
      offset: 0,
    });
  });
});
