import { AmlMonitorService } from "./aml-monitor.service";

function makeService() {
  const amlFlagRepo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: Record<string, unknown>) =>
      Promise.resolve({ id: "flag-1", ...x }),
    ),
    find: jest.fn(),
  };
  const service = new AmlMonitorService(amlFlagRepo as never);
  return { service, amlFlagRepo };
}

describe("AmlMonitorService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does NOT flag transactions below the threshold", async () => {
    const { service, amlFlagRepo } = makeService();
    const flagged = await service.checkAndFlag({
      userAddress: "0xabc",
      amountUsd: 9_999.99,
      txType: "withdrawal",
    });
    expect(flagged).toBe(false);
    expect(amlFlagRepo.save).not.toHaveBeenCalled();
  });

  it("flags and persists transactions AT the threshold", async () => {
    const { service, amlFlagRepo } = makeService();
    const flagged = await service.checkAndFlag({
      userAddress: "0xabc",
      amountUsd: AmlMonitorService.USD_THRESHOLD,
      txType: "withdrawal",
      context: { gameId: "g1" },
    });
    expect(flagged).toBe(true);
    expect(amlFlagRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userAddress: "0xabc",
        amountUsd: AmlMonitorService.USD_THRESHOLD,
        txType: "withdrawal",
        reviewed: false,
      }),
    );
    expect(amlFlagRepo.save).toHaveBeenCalled();
  });

  it("flags and persists transactions ABOVE the threshold", async () => {
    const { service, amlFlagRepo } = makeService();
    const flagged = await service.checkAndFlag({
      userAddress: "0xdef",
      amountUsd: 50_000,
      txType: "purchase",
    });
    expect(flagged).toBe(true);
    expect(amlFlagRepo.save).toHaveBeenCalled();
  });

  it("normalizes userAddress to lowercase when flagging", async () => {
    const { service, amlFlagRepo } = makeService();
    await service.checkAndFlag({
      userAddress: "0xABCDEF",
      amountUsd: 20_000,
      txType: "withdrawal",
    });
    expect(amlFlagRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userAddress: "0xabcdef" }),
    );
  });

  it("returns false and does NOT flag when amountUsd is null (no price data)", async () => {
    const { service, amlFlagRepo } = makeService();
    const flagged = await service.checkAndFlag({
      userAddress: "0xabc",
      amountUsd: null,
      txType: "withdrawal",
    });
    expect(flagged).toBe(false);
    expect(amlFlagRepo.save).not.toHaveBeenCalled();
  });

  it("getUnreviewedFlags returns flags ordered by most recent first", async () => {
    const { service, amlFlagRepo } = makeService();
    const flags = [{ id: "f1" }, { id: "f2" }];
    amlFlagRepo.find.mockResolvedValueOnce(flags);
    const result = await service.getUnreviewedFlags();
    expect(result).toBe(flags);
    expect(amlFlagRepo.find).toHaveBeenCalledWith({
      where: { reviewed: false },
      order: { flaggedAt: "DESC" },
    });
  });
});
