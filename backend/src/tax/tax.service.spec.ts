/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TaxService } from "./tax.service";
import { TaxEvent } from "./entities/tax-event.entity";

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
};

function makeEvent(partial: Partial<TaxEvent>): TaxEvent {
  return {
    id: 1,
    type: "acquisition",
    userAddress: "0xuser",
    assetAddress: "0xasset",
    tokenId: 1,
    amount: 1,
    feeUSD: 0,
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  } as TaxEvent;
}

describe("TaxService", () => {
  let repo: MockRepo;
  let costBasisRepo: MockRepo;
  let service: TaxService;

  beforeEach(() => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    costBasisRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    service = new TaxService(repo as never, costBasisRepo as never);
  });

  it("logEvent creates and saves event", async () => {
    const payload = { userAddress: "0xabc", type: "reward" as const };
    const result = await service.logEvent(payload);

    expect(repo.create).toHaveBeenCalledWith(payload);
    expect(repo.save).toHaveBeenCalledWith(payload);
    expect(result).toEqual(payload);
  });

  it("getEventsForUser queries sorted events", async () => {
    repo.find.mockResolvedValueOnce([]);
    await service.getEventsForUser("0xabc");

    expect(repo.find).toHaveBeenCalledWith({
      where: { userAddress: "0xabc" },
      order: { timestamp: "ASC" },
    });
  });

  it("getSummary calculates gains, losses and adjusted losses", async () => {
    repo.find.mockResolvedValueOnce([
      makeEvent({
        type: "acquisition",
        amount: 2,
        priceUSD: 100,
      }),
      makeEvent({
        type: "acquisition",
        amount: 1,
        priceUSD: 130,
      }),
      makeEvent({
        type: "disposal",
        amount: 1,
        priceUSD: 150,
      }),
      makeEvent({
        type: "disposal",
        amount: 1,
        priceUSD: 90,
      }),
    ]);

    await expect(service.getSummary("0xuser")).resolves.toEqual({
      totalGainsUSD: 40,
      totalLossesUSD: -20,
      adjustedLossesUSD: -14,
      netTaxableGainUSD: 26,
    });
  });

  it("getSummary handles disposal without prior acquisition", async () => {
    repo.find.mockResolvedValueOnce([
      makeEvent({
        type: "disposal",
        amount: 2,
        priceUSD: 12.5,
      }),
    ]);

    await expect(service.getSummary("0xuser")).resolves.toEqual({
      totalGainsUSD: 25,
      totalLossesUSD: 0,
      adjustedLossesUSD: 0,
      netTaxableGainUSD: 25,
    });
  });

  it("exportEventsAsCSV writes headers and csv body", async () => {
    repo.find.mockResolvedValueOnce([
      makeEvent({
        type: "reward",
        amount: 3,
        priceUSD: 5,
        feeUSD: 0.25,
      }),
    ]);

    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await service.exportEventsAsCSV("0xuser", res as never);

    expect(res.setHeader).toHaveBeenNthCalledWith(
      1,
      "Content-Type",
      "text/csv",
    );
    expect(res.setHeader).toHaveBeenNthCalledWith(
      2,
      "Content-Disposition",
      "attachment; filename=tax-report.csv",
    );
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(res.send.mock.calls[0][0]).toContain(
      "Date,Type,Asset,TokenID,Amount,PriceUSD,FeeUSD",
    );
    expect(res.send.mock.calls[0][0]).toContain(",reward,0xasset,1,3,5,0.25");
  });

  // ─── Cost-basis coverage tests ──────────────────────────────

  it("logEvent updates cost-basis for acquisition events", async () => {
    const saved = makeEvent({
      id: 10,
      type: "acquisition",
      userAddress: "0xuser",
      assetAddress: "0xasset",
      tokenId: 1,
      amount: 5,
      priceUSD: 100,
    });
    repo.save.mockResolvedValueOnce(saved);
    costBasisRepo.findOne.mockResolvedValueOnce(null);

    await service.logEvent({
      type: "acquisition",
      userAddress: "0xUser",
      assetAddress: "0xAsset",
      tokenId: 1,
      amount: 5,
      priceUSD: 100,
    });

    // Should have created a new cost-basis entry (mock mutates in-place)
    expect(costBasisRepo.create).toHaveBeenCalledTimes(1);
    // Should save with updated quantity and cost
    expect(costBasisRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        totalCost: 500,
        lastProcessedEventId: 10,
      }),
    );
  });

  it("logEvent updates cost-basis for disposal with gain", async () => {
    const saved = makeEvent({
      id: 20,
      type: "disposal",
      userAddress: "0xuser",
      assetAddress: "0xasset",
      tokenId: 1,
      amount: 2,
      priceUSD: 150,
    });
    repo.save.mockResolvedValueOnce(saved);
    // Existing basis: bought 5 at $100 each = totalCost 500
    costBasisRepo.findOne.mockResolvedValueOnce({
      userAddress: "0xuser",
      assetKey: "0xasset:1",
      quantity: 5,
      totalCost: 500,
      realizedGains: 0,
      realizedLosses: 0,
      lastProcessedEventId: 10,
    });

    await service.logEvent({
      type: "disposal",
      userAddress: "0xUser",
      assetAddress: "0xAsset",
      tokenId: 1,
      amount: 2,
      priceUSD: 150,
    });

    // Average cost = 500/5 = $100, selling at $150, gain = (150-100)*2 = 100
    expect(costBasisRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 3,
        totalCost: 300,
        realizedGains: 100,
        lastProcessedEventId: 20,
      }),
    );
  });

  it("logEvent updates cost-basis for disposal with loss", async () => {
    const saved = makeEvent({
      id: 30,
      type: "disposal",
      userAddress: "0xuser",
      assetAddress: "0xasset",
      tokenId: 1,
      amount: 1,
      priceUSD: 50,
    });
    repo.save.mockResolvedValueOnce(saved);
    costBasisRepo.findOne.mockResolvedValueOnce({
      userAddress: "0xuser",
      assetKey: "0xasset:1",
      quantity: 3,
      totalCost: 300,
      realizedGains: 100,
      realizedLosses: 0,
      lastProcessedEventId: 20,
    });

    await service.logEvent({
      type: "disposal",
      userAddress: "0xUser",
      assetAddress: "0xAsset",
      tokenId: 1,
      amount: 1,
      priceUSD: 50,
    });

    // Average cost = 300/3 = $100, selling at $50, loss = (50-100)*1 = -50
    expect(costBasisRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        realizedLosses: -50,
        lastProcessedEventId: 30,
      }),
    );
  });

  it("getSummary uses optimized path when cost-basis data exists", async () => {
    // Return cost-basis entries instead of empty array
    costBasisRepo.find.mockResolvedValueOnce([
      {
        realizedGains: 100,
        realizedLosses: -50,
      },
      {
        realizedGains: 25,
        realizedLosses: -10,
      },
    ]);

    const result = await service.getSummary("0xuser");

    // totalGains = 100 + 25 = 125
    // totalLosses = -50 + -10 = -60
    // adjustedLosses = -60 * 0.7 = -42
    // netTaxable = 125 + (-42) = 83
    expect(result).toEqual({
      totalGainsUSD: 125,
      totalLossesUSD: -60,
      adjustedLossesUSD: -42,
      netTaxableGainUSD: 83,
    });

    // Should NOT have loaded events from the main repo
    expect(repo.find).not.toHaveBeenCalled();
  });

  it("updateCostBasis skips already-processed events (idempotency)", async () => {
    const saved = makeEvent({
      id: 5,
      type: "acquisition",
      userAddress: "0xuser",
      assetAddress: "0xasset",
      tokenId: 1,
      amount: 10,
      priceUSD: 100,
    });
    repo.save.mockResolvedValueOnce(saved);
    // Basis already processed event id=5
    costBasisRepo.findOne.mockResolvedValueOnce({
      userAddress: "0xuser",
      assetKey: "0xasset:1",
      quantity: 5,
      totalCost: 500,
      realizedGains: 0,
      realizedLosses: 0,
      lastProcessedEventId: 5,
    });

    await service.logEvent({
      type: "acquisition",
      userAddress: "0xUser",
      assetAddress: "0xAsset",
      tokenId: 1,
      amount: 10,
      priceUSD: 100,
    });

    // costBasisRepo.save should NOT be called (event already processed)
    expect(costBasisRepo.save).not.toHaveBeenCalled();
  });

  it("logEvent does not update cost-basis for non-acquisition/disposal types", async () => {
    const saved = makeEvent({
      id: 1,
      type: "reward",
      userAddress: "0xuser",
      assetAddress: "0xasset",
    });
    repo.save.mockResolvedValueOnce(saved);

    await service.logEvent({
      type: "reward",
      userAddress: "0xuser",
      assetAddress: "0xasset",
    });

    expect(costBasisRepo.findOne).not.toHaveBeenCalled();
    expect(costBasisRepo.save).not.toHaveBeenCalled();
  });
});
