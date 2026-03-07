import { AdminController } from "./admin.controller";

describe("AdminController", () => {
  const service = {
    getFeeStats: jest.fn(),
    getRevenueSplit: jest.fn(),
    getUserList: jest.fn(),
  };
  const controller = new AdminController(service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getFeeStats", async () => {
    service.getFeeStats.mockResolvedValueOnce({ ok: true });
    await expect(controller.getFeeStats("a", "b")).resolves.toEqual({ ok: true });
    expect(service.getFeeStats).toHaveBeenCalledWith("a", "b");
  });

  it("delegates getRevenue", async () => {
    service.getRevenueSplit.mockResolvedValueOnce({ ok: true });
    await expect(controller.getRevenue("a", "b")).resolves.toEqual({ ok: true });
    expect(service.getRevenueSplit).toHaveBeenCalledWith("a", "b");
  });

  it("delegates getAllUsers", async () => {
    service.getUserList.mockResolvedValueOnce([{ id: "u1" }]);
    await expect(controller.getAllUsers()).resolves.toEqual([{ id: "u1" }]);
    expect(service.getUserList).toHaveBeenCalled();
  });
});
