/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ethers } from "ethers";
import tokenShopAbi from "../shared/constants/abis/TokenShop.json";
import { TaxEvent } from "../tax/entities/tax-event.entity";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopSyncState } from "./entities/tokenshop-sync-state.entity";
import { TokenShopListenerService } from "./tokenshop-listener.service";

type MockRepo<T> = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
};

function makeRepo<T>(): MockRepo<T> {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
  };
}

function encodeEventLog(
  name: "Bought" | "Sold",
  values: {
    user: string;
    payAsset: string;
    amountIn?: bigint;
    genOut?: bigint;
    genIn?: bigint;
    amountOut?: bigint;
  },
) {
  const iface = new ethers.Interface(tokenShopAbi);
  const fragment = iface.getEvent(name);
  if (!fragment) {
    throw new Error(`Missing event fragment: ${name}`);
  }
  const args =
    name === "Bought"
      ? [values.user, values.payAsset, values.amountIn, values.genOut]
      : [values.user, values.payAsset, values.genIn, values.amountOut];
  const encoded = iface.encodeEventLog(fragment, args);

  return {
    topics: encoded.topics,
    data: encoded.data,
    transactionHash:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    index: 7,
    blockNumber: 0,
  };
}

describe("TokenShopListenerService", () => {
  let taxEventRepo: MockRepo<TaxEvent>;
  let shopEventRepo: MockRepo<ShopEvent>;
  let syncStateRepo: MockRepo<TokenShopSyncState>;
  let taxService: { logEvent: jest.Mock };
  let service: TokenShopListenerService;
  const originalTokenShopEthUsd = process.env.TOKENSHOP_ETH_USD;

  beforeEach(() => {
    process.env.TOKENSHOP_ETH_USD = "3500";
    taxEventRepo = makeRepo<TaxEvent>();
    shopEventRepo = makeRepo<ShopEvent>();
    syncStateRepo = makeRepo<TokenShopSyncState>();
    taxService = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    service = new TokenShopListenerService(
      taxEventRepo as never,
      shopEventRepo as never,
      syncStateRepo as never,
      taxService as never,
    );
  });

  afterEach(() => {
    if (originalTokenShopEthUsd === undefined) {
      delete process.env.TOKENSHOP_ETH_USD;
      return;
    }

    process.env.TOKENSHOP_ETH_USD = originalTokenShopEthUsd;
  });

  it("parseLog maps Bought event into normalized internal shape", () => {
    const payAsset = "0x0000000000000000000000000000000000000000";
    const log = encodeEventLog("Bought", {
      user: "0xabc0000000000000000000000000000000000000",
      payAsset,
      amountIn: ethers.parseEther("1"),
      genOut: ethers.parseUnits("250", 18),
    });

    const parsed = (service as any).parseLog(log);

    expect(parsed).toEqual({
      name: "Bought",
      userAddress: "0xabc0000000000000000000000000000000000000",
      payAsset,
      amountInRaw: ethers.parseEther("1"),
      triAmountRaw: ethers.parseUnits("250", 18),
      txHash: log.transactionHash,
      logIndex: 7,
      blockNumber: 0,
    });
  });

  it("persistParsedEvent stores both shop event and tax event atomically", async () => {
    taxEventRepo.findOne.mockResolvedValueOnce(null);
    shopEventRepo.findOne.mockResolvedValueOnce(null);
    (service as any).triTokenAddress =
      "0x9999999999999999999999999999999999999999";

    await (service as any).persistParsedEvent({
      name: "Bought",
      userAddress: "0xabc",
      payAsset: ethers.ZeroAddress.toLowerCase(),
      amountInRaw: ethers.parseEther("2"),
      triAmountRaw: ethers.parseUnits("100", 18),
      txHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      logIndex: 3,
      blockNumber: 42,
    });

    expect(shopEventRepo.create).toHaveBeenCalledWith({
      type: "BUY",
      blockNumber: 42,
      txHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      logIndex: 3,
      user: "0xabc",
      asset: ethers.ZeroAddress.toLowerCase(),
      assetSymbol: "ETH",
      amountIn: ethers.parseEther("2").toString(),
      amountOut: ethers.parseUnits("100", 18).toString(),
    });
    expect(taxService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "acquisition",
        userAddress: "0xabc",
        assetAddress: "0x9999999999999999999999999999999999999999",
        tokenId: 0,
        amount: 100,
        feeUSD: 0,
        priceUSD: 70,
        valuationStatus: "estimated",
        valuationSource: "tokenshop_eth_usd_snapshot",
        source: "tokenshop",
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logIndex: 3,
        timestamp: expect.any(Date),
      }),
    );
  });

  it("withholds fiat pricing for non-ETH payment assets", async () => {
    taxEventRepo.findOne.mockResolvedValueOnce(null);
    shopEventRepo.findOne.mockResolvedValueOnce(null);
    (service as any).triTokenAddress =
      "0x9999999999999999999999999999999999999999";

    await (service as any).persistParsedEvent({
      name: "Bought",
      userAddress: "0xabc",
      payAsset: "0x1111111111111111111111111111111111111111",
      amountInRaw: ethers.parseUnits("200", 18),
      triAmountRaw: ethers.parseUnits("100", 18),
      txHash:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      logIndex: 4,
      blockNumber: 43,
    });

    expect(taxService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        priceUSD: undefined,
        valuationStatus: "missing",
        valuationSource: null,
      }),
    );
  });

  it("persistParsedEvent skips duplicates when tax event already exists", async () => {
    taxEventRepo.findOne.mockResolvedValueOnce({
      id: 1,
    });

    await (service as any).persistParsedEvent({
      name: "Sold",
      userAddress: "0xabc",
      payAsset: ethers.ZeroAddress.toLowerCase(),
      amountInRaw: ethers.parseEther("2"),
      triAmountRaw: ethers.parseUnits("100", 18),
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      logIndex: 9,
      blockNumber: 9,
    });

    expect(shopEventRepo.save).not.toHaveBeenCalled();
    expect(taxService.logEvent).not.toHaveBeenCalled();
  });

  it("persistParsedEvent skips duplicates when shop event already exists", async () => {
    taxEventRepo.findOne.mockResolvedValueOnce(null);
    shopEventRepo.findOne.mockResolvedValueOnce({
      id: 1,
    });

    await (service as any).persistParsedEvent({
      name: "Bought",
      userAddress: "0xabc",
      payAsset: ethers.ZeroAddress.toLowerCase(),
      amountInRaw: ethers.parseEther("1"),
      triAmountRaw: ethers.parseUnits("10", 18),
      txHash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      logIndex: 1,
      blockNumber: 8,
    });

    expect(shopEventRepo.save).not.toHaveBeenCalled();
    expect(taxService.logEvent).not.toHaveBeenCalled();
  });

  it("syncOnce ingests bought and sold events and updates sync state", async () => {
    const syncState = {
      id: "tokenshop",
      lastSyncedBlock: "4",
    };

    syncStateRepo.findOne.mockResolvedValueOnce(syncState);
    syncStateRepo.save.mockResolvedValue(syncState);
    taxEventRepo.findOne.mockResolvedValue(null);
    shopEventRepo.findOne.mockResolvedValue(null);

    (service as any).provider = {
      getBlockNumber: jest.fn().mockResolvedValue(6),
      getBlock: jest.fn().mockResolvedValue(null),
    };
    (service as any).contract = {
      filters: {
        Bought: jest.fn().mockReturnValue("BoughtFilter"),
        Sold: jest.fn().mockReturnValue("SoldFilter"),
      },
      queryFilter: jest
        .fn()
        .mockResolvedValueOnce([
          encodeEventLog("Bought", {
            user: "0xabc0000000000000000000000000000000000000",
            payAsset: ethers.ZeroAddress,
            amountIn: ethers.parseEther("1"),
            genOut: ethers.parseUnits("10", 18),
          }),
        ])
        .mockResolvedValueOnce([
          encodeEventLog("Sold", {
            user: "0xabc0000000000000000000000000000000000000",
            payAsset: ethers.ZeroAddress,
            genIn: ethers.parseUnits("5", 18),
            amountOut: ethers.parseEther("0.25"),
          }),
        ]),
      token: jest
        .fn()
        .mockResolvedValue("0x9999999999999999999999999999999999999999"),
    };
    (service as any).triTokenAddress =
      "0x9999999999999999999999999999999999999999";

    await (service as any).syncOnce();

    expect(shopEventRepo.save).toHaveBeenCalledTimes(2);
    expect(taxService.logEvent).toHaveBeenCalledTimes(2);
    expect(syncStateRepo.save).toHaveBeenCalledWith({
      id: "tokenshop",
      lastSyncedBlock: "6",
    });
  });
});
