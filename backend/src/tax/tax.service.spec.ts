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
});
