/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  EconomicDirection,
  EconomicEvent,
  EconomicScopeType,
} from "./entities/economic-event.entity";
import { EconomicsService } from "./economics.service";

function makeRepo() {
  return {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "evt-1", ...x })),
    find: jest.fn(async () => []),
  };
}

describe("EconomicsService", () => {
  let service: EconomicsService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EconomicsService,
        {
          provide: getRepositoryToken(EconomicEvent),
          useValue: repo,
        },
      ],
    }).compile();

    service = moduleRef.get(EconomicsService);
  });

  it("logs global events without studio or game attribution", async () => {
    await service.logEvent({
      source: "tokenshop",
      eventType: "buy_tri",
      scopeType: EconomicScopeType.GLOBAL,
      assetKey: "tri",
      amount: "10",
      direction: EconomicDirection.IN,
      walletAddress: "0xABCDEF",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeType: EconomicScopeType.GLOBAL,
        studioId: null,
        gameId: null,
        walletAddress: "0xabcdef",
      }),
    );
  });

  it("rejects global events with studio attribution", async () => {
    await expect(
      service.logEvent({
        source: "tokenshop",
        eventType: "buy_tri",
        scopeType: EconomicScopeType.GLOBAL,
        studioId: "studio-1",
        assetKey: "tri",
        amount: "10",
        direction: EconomicDirection.IN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires studioId for studio scope", async () => {
    await expect(
      service.logEvent({
        source: "studio-store",
        eventType: "spend_currency",
        scopeType: EconomicScopeType.STUDIO,
        assetKey: "microsoft-coins",
        amount: "5",
        direction: EconomicDirection.OUT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires studioId and gameId for game scope", async () => {
    await expect(
      service.logEvent({
        source: "game-server",
        eventType: "loot_drop",
        scopeType: EconomicScopeType.GAME,
        studioId: "studio-1",
        assetKey: "gold",
        amount: "100",
        direction: EconomicDirection.IN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts fully attributed game events", async () => {
    await service.logEvent({
      source: "game-server",
      eventType: "loot_drop",
      scopeType: EconomicScopeType.GAME,
      studioId: "studio-1",
      gameId: "game-1",
      gamePlayerId: "player-1",
      userId: "user-1",
      walletAddress: "0x1234",
      assetKey: "gold",
      assetSymbol: "GOLD",
      amount: "100",
      direction: EconomicDirection.IN,
    });

    expect(repo.save).toHaveBeenCalled();
  });
});
