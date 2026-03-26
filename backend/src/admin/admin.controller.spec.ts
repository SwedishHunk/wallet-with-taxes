import { AdminController } from "./admin.controller";

describe("AdminController", () => {
  const service = {
    getFeeStats: jest.fn(),
    getRevenueSplit: jest.fn(),
    getUserList: jest.fn(),
    getAllStudios: jest.fn(),
    getAllTransactions: jest.fn(),
  };
  const dataRetentionService = {
    runManually: jest.fn(),
  };
  const reconciliationService = {
    runManually: jest.fn(),
  };
  const controller = new AdminController(
    service as never,
    dataRetentionService as never,
    reconciliationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getFeeStats", async () => {
    service.getFeeStats.mockResolvedValueOnce({ ok: true });
    await expect(controller.getFeeStats("a", "b")).resolves.toEqual({
      ok: true,
    });
    expect(service.getFeeStats).toHaveBeenCalledWith("a", "b");
  });

  it("delegates getRevenue", async () => {
    service.getRevenueSplit.mockResolvedValueOnce({ ok: true });
    await expect(controller.getRevenue("a", "b")).resolves.toEqual({
      ok: true,
    });
    expect(service.getRevenueSplit).toHaveBeenCalledWith("a", "b");
  });

  it("delegates getAllUsers", async () => {
    service.getUserList.mockResolvedValueOnce([{ id: "u1" }]);
    await expect(controller.getAllUsers()).resolves.toEqual([{ id: "u1" }]);
    expect(service.getUserList).toHaveBeenCalled();
  });

  it("delegates getAllStudios", async () => {
    service.getAllStudios.mockResolvedValueOnce([{ id: "s1" }]);
    await expect(controller.getAllStudios()).resolves.toEqual([{ id: "s1" }]);
    expect(service.getAllStudios).toHaveBeenCalled();
  });

  it("delegates getAllTransactions with default pagination", async () => {
    service.getAllTransactions.mockResolvedValueOnce({ events: [], total: 0 });
    await controller.getAllTransactions();
    expect(service.getAllTransactions).toHaveBeenCalledWith(50, 0);
  });

  it("delegates getAllTransactions with explicit pagination", async () => {
    service.getAllTransactions.mockResolvedValueOnce({ events: [], total: 0 });
    await controller.getAllTransactions("10", "20");
    expect(service.getAllTransactions).toHaveBeenCalledWith(10, 20);
  });

  it("delegates runDataRetention", async () => {
    dataRetentionService.runManually.mockResolvedValueOnce({ anonymized: 2 });
    await expect(controller.runDataRetention()).resolves.toEqual({
      anonymized: 2,
    });
    expect(dataRetentionService.runManually).toHaveBeenCalled();
  });

  it("delegates runReconciliation", async () => {
    reconciliationService.runManually.mockResolvedValueOnce({ ok: true });
    await expect(controller.runReconciliation()).resolves.toEqual({ ok: true });
    expect(reconciliationService.runManually).toHaveBeenCalled();
  });
});
