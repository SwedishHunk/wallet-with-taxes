import { NotFoundException } from "@nestjs/common";
import { AmlMonitorService } from "./aml-monitor.service";

function makeService() {
  const amlFlagRepo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: Record<string, unknown>) =>
      Promise.resolve({ id: "flag-1", ...x }),
    ),
    find: jest.fn(),
    findOne: jest.fn(),
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

  // ── reviewFlag ─────────────────────────────────────────────────────────────

  it("reviewFlag marks flag as reviewed and saves", async () => {
    const { service, amlFlagRepo } = makeService();
    const existingFlag = {
      id: "f1",
      reviewed: false,
      reviewNotes: null,
    } as Record<string, unknown>;
    amlFlagRepo.findOne.mockResolvedValueOnce(existingFlag);
    amlFlagRepo.save.mockImplementationOnce((x: Record<string, unknown>) =>
      Promise.resolve(x as unknown as { id: string }),
    );

    const result = await service.reviewFlag("f1", "Reviewed — no issue.");

    expect(amlFlagRepo.findOne).toHaveBeenCalledWith({ where: { id: "f1" } });
    expect(existingFlag.reviewed).toBe(true);
    expect(existingFlag.reviewNotes).toBe("Reviewed — no issue.");
    expect(amlFlagRepo.save).toHaveBeenCalledWith(existingFlag);
    expect((result as unknown as Record<string, unknown>).reviewed).toBe(true);
  });

  it("reviewFlag sets reviewNotes to null when not provided", async () => {
    const { service, amlFlagRepo } = makeService();
    const existingFlag = {
      id: "f2",
      reviewed: false,
      reviewNotes: null,
    } as Record<string, unknown>;
    amlFlagRepo.findOne.mockResolvedValueOnce(existingFlag);
    amlFlagRepo.save.mockImplementationOnce((x: Record<string, unknown>) =>
      Promise.resolve(x as unknown as { id: string }),
    );

    await service.reviewFlag("f2");

    expect(existingFlag.reviewNotes).toBeNull();
  });

  it("reviewFlag throws NotFoundException when flag does not exist", async () => {
    const { service, amlFlagRepo } = makeService();
    amlFlagRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.reviewFlag("nonexistent")).rejects.toThrow(
      NotFoundException,
    );
    expect(amlFlagRepo.save).not.toHaveBeenCalled();
  });
});
