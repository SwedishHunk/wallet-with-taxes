import { ReconciliationService } from "./reconciliation.service";

function makeService(
  overrides: {
    taxEventCount?: number;
    disposalCount?: number;
    withdrawalCount?: number;
    missingValuationCount?: number;
    verifiedNoTinCount?: number;
  } = {},
) {
  const {
    taxEventCount = 0,
    disposalCount = 0,
    withdrawalCount = 0,
    missingValuationCount = 0,
    verifiedNoTinCount = 0,
  } = overrides;

  const taxEventRepo = {
    count: jest
      .fn()
      .mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where.valuationStatus === "missing")
          return Promise.resolve(missingValuationCount);
        if (where.type === "disposal") return Promise.resolve(disposalCount);
        return Promise.resolve(taxEventCount);
      }),
  };

  const ledgerEntryRepo = {
    count: jest.fn().mockResolvedValue(withdrawalCount),
  };

  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(verifiedNoTinCount),
  };

  const userRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };

  const service = new ReconciliationService(
    taxEventRepo as never,
    ledgerEntryRepo as never,
    userRepo as never,
  );

  return { service, taxEventRepo, ledgerEntryRepo, userRepo };
}

describe("ReconciliationService", () => {
  it("returns ok=true when no discrepancies found", async () => {
    const { service } = makeService({
      missingValuationCount: 5, // missing valuations don't break ok flag
      disposalCount: 3,
      withdrawalCount: 3,
      verifiedNoTinCount: 0,
    });
    const report = await service.runManually();
    expect(report.ok).toBe(true);
    expect(report.unmatchedWithdrawalLedgerEntries).toBe(0);
    expect(report.unmatchedDisposalTaxEvents).toBe(0);
    expect(report.verifiedUsersWithoutTin).toBe(0);
  });

  it("reports unmatched withdrawal ledger entries when withdrawals > disposals", async () => {
    const { service } = makeService({
      disposalCount: 2,
      withdrawalCount: 5,
      verifiedNoTinCount: 0,
    });
    const report = await service.runManually();
    expect(report.unmatchedWithdrawalLedgerEntries).toBe(3);
    expect(report.ok).toBe(false);
  });

  it("reports unmatched disposal TaxEvents when disposals > withdrawals", async () => {
    const { service } = makeService({
      disposalCount: 6,
      withdrawalCount: 2,
      verifiedNoTinCount: 0,
    });
    const report = await service.runManually();
    expect(report.unmatchedDisposalTaxEvents).toBe(4);
    expect(report.ok).toBe(false);
  });

  it("reports verified users without TIN (DAC8 gap)", async () => {
    const { service } = makeService({
      disposalCount: 1,
      withdrawalCount: 1,
      verifiedNoTinCount: 7,
    });
    const report = await service.runManually();
    expect(report.verifiedUsersWithoutTin).toBe(7);
    expect(report.ok).toBe(false);
  });

  it("includes missingValuationCount in report (informational only)", async () => {
    const { service } = makeService({
      missingValuationCount: 42,
      verifiedNoTinCount: 0,
    });
    const report = await service.runManually();
    expect(report.missingValuationCount).toBe(42);
  });

  it("includes windowHours and ranAt metadata", async () => {
    const { service } = makeService();
    const report = await service.runManually();
    expect(report.windowHours).toBe(ReconciliationService.WINDOW_HOURS);
    expect(typeof report.ranAt).toBe("string");
    expect(report.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("clamps negative mismatch counts to 0", async () => {
    // More disposals than withdrawals would normally give a negative unmatched-
    // withdrawal count — ensure it's clamped to 0.
    const { service } = makeService({
      disposalCount: 10,
      withdrawalCount: 5,
      verifiedNoTinCount: 0,
    });
    const report = await service.runManually();
    expect(report.unmatchedWithdrawalLedgerEntries).toBe(0);
    expect(report.unmatchedDisposalTaxEvents).toBe(5);
  });
});
