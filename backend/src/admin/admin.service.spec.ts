import { AdminService } from "./admin.service";

function makeQuery(raw: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
}

describe("AdminService", () => {
  it("getFeeStats returns defaults when raw is null", async () => {
    const query = makeQuery(null);
    const taxRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const userRepo = { find: jest.fn() };
    const service = new AdminService(taxRepo as never, userRepo as never);

    await expect(service.getFeeStats()).resolves.toEqual({
      totalFeesUSD: 0,
      totalTrades: 0,
      from: undefined,
      to: undefined,
    });
  });

  it("getFeeStats applies date filters", async () => {
    const query = makeQuery({ totalFeesUSD: "12.5", totalTrades: "3" });
    const taxRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const userRepo = { find: jest.fn() };
    const service = new AdminService(taxRepo as never, userRepo as never);

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
    const query = makeQuery({ totalFeesUSD: "100" });
    const taxRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const userRepo = { find: jest.fn() };
    const service = new AdminService(taxRepo as never, userRepo as never);

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
    const query = makeQuery({ totalFeesUSD: "50" });
    const taxRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const userRepo = { find: jest.fn() };
    const service = new AdminService(taxRepo as never, userRepo as never);
    await service.getRevenueSplit("2026-01-01");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp >= :from", {
      from: "2026-01-01",
    });
  });

  it("getRevenueSplit applies to-only date filter", async () => {
    const query = makeQuery({ totalFeesUSD: "12" });
    const taxRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const userRepo = { find: jest.fn() };
    const service = new AdminService(taxRepo as never, userRepo as never);
    await service.getRevenueSplit(undefined, "2026-01-31");
    expect(query.andWhere).toHaveBeenCalledWith("tax.timestamp <= :to", {
      to: "2026-01-31",
    });
  });

  it("getUserList returns repository selection", async () => {
    const users = [{ id: "u1" }];
    const taxRepo = { createQueryBuilder: jest.fn() };
    const userRepo = { find: jest.fn().mockResolvedValue(users) };
    const service = new AdminService(taxRepo as never, userRepo as never);
    await expect(service.getUserList()).resolves.toEqual(users);
  });
});
