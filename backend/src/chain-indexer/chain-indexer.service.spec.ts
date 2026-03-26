import { ethers } from "ethers";
import { ChainIndexerService } from "./chain-indexer.service";

/**
 * Standalone type that mirrors the full surface of ChainIndexerService
 * (public + private). Used only to cast in tests so that TypeScript can
 * verify member names without triggering no-unsafe-member-access.
 *
 * NOTE: NOT an intersection with ChainIndexerService — that collapses to
 * `never` because private fields appear in both sides.
 */
type ServicePrivate = {
  // ── public ──────────────────────────────────────────────────────────────
  isEnabled(): boolean;
  onModuleInit(): void;
  onModuleDestroy(): void;
  connectAndListen(): Promise<void>;
  // ── private ─────────────────────────────────────────────────────────────
  provider: { getBlock: jest.Mock; destroy?: jest.Mock } | null;
  marketplaceContract: { removeAllListeners: jest.Mock } | null;
  triContract: { removeAllListeners: jest.Mock } | null;
  destroyed: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelayMs: number;
  disconnect(): Promise<void>;
  scheduleReconnect(): void;
  handleMarketplaceSold(
    seller: string,
    buyer: string,
    assetAddress: string,
    tokenId: bigint,
    price: bigint,
    fee: bigint,
    event: { blockNumber: number; transactionHash: string },
  ): Promise<void>;
  handleTriTransfer(
    from: string,
    to: string,
    value: bigint,
    event: { blockNumber: number; transactionHash: string },
  ): Promise<void>;
  getBlockTimestamp(blockNumber: number): Promise<Date>;
};

function makeService() {
  const taxService = {
    logEvent: jest.fn().mockResolvedValue({}),
  };
  const service = new ChainIndexerService(taxService as never);
  return { service, taxService, svc: service as unknown as ServicePrivate };
}

describe("ChainIndexerService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    delete process.env.CHAIN_INDEXER_ENABLED;
    delete process.env.WS_RPC_URL;
    delete process.env.MARKETPLACE_ADDRESS;
    delete process.env.TRI_TOKEN_ADDRESS;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── isEnabled ─────────────────────────────────────────────────────────────

  it("isEnabled returns false when CHAIN_INDEXER_ENABLED is not set", () => {
    const { service } = makeService();
    delete process.env.CHAIN_INDEXER_ENABLED;
    expect(service.isEnabled()).toBe(false);
  });

  it("isEnabled returns false when WS_RPC_URL is missing even if enabled flag is set", () => {
    const { service } = makeService();
    process.env.CHAIN_INDEXER_ENABLED = "true";
    delete process.env.WS_RPC_URL;
    expect(service.isEnabled()).toBe(false);
  });

  it("isEnabled returns true when both flags are set", () => {
    const { service } = makeService();
    process.env.CHAIN_INDEXER_ENABLED = "true";
    process.env.WS_RPC_URL = "ws://localhost:8545";
    expect(service.isEnabled()).toBe(true);
  });

  // ── onModuleInit ───────────────────────────────────────────────────────────

  it("onModuleInit does NOT attempt connection when disabled", () => {
    const { service } = makeService();
    delete process.env.CHAIN_INDEXER_ENABLED;
    const connectSpy = jest
      .spyOn(service, "connectAndListen")
      .mockResolvedValue(undefined);
    service.onModuleInit();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("onModuleInit calls connectAndListen when enabled", () => {
    process.env.CHAIN_INDEXER_ENABLED = "true";
    process.env.WS_RPC_URL = "ws://localhost:8545";
    const { service } = makeService();
    const connectSpy = jest
      .spyOn(service, "connectAndListen")
      .mockResolvedValue(undefined);
    service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  // ── onModuleDestroy ────────────────────────────────────────────────────────

  it("onModuleDestroy does not throw when no connection is active", () => {
    const { service } = makeService();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  it("onModuleDestroy clears a pending reconnect timer", () => {
    jest.useFakeTimers();
    const { service, svc } = makeService();
    svc.reconnectTimer = setTimeout(() => {}, 30_000);
    service.onModuleDestroy();
    expect(svc.destroyed).toBe(true);
  });

  // ── connectAndListen error path ────────────────────────────────────────────

  it("connectAndListen schedules reconnect when provider fails to connect", async () => {
    process.env.CHAIN_INDEXER_ENABLED = "true";
    process.env.WS_RPC_URL = "ws://localhost:9999"; // unreachable
    const { service } = makeService();

    const scheduleSpy = jest
      .spyOn(service as any, "scheduleReconnect")
      .mockImplementation(() => undefined);

    // Mock WebSocketProvider to throw immediately
    const { ethers: ethersActual } =
      jest.requireActual<typeof import("ethers")>("ethers");
    jest.spyOn(ethersActual, "WebSocketProvider").mockImplementationOnce(() => {
      throw new Error("connection refused");
    });

    await service.connectAndListen();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
  });

  // ── connectAndListen happy path ────────────────────────────────────────────

  it("connectAndListen subscribes to Sold and Transfer when both addresses are set", async () => {
    process.env.WS_RPC_URL = "ws://localhost:8545";
    process.env.MARKETPLACE_ADDRESS = "0xmarketplace";
    process.env.TRI_TOKEN_ADDRESS = "0xtri";
    const { service } = makeService();

    const mockOnFn = jest.fn().mockResolvedValue(undefined);
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(100),
      websocket: { addEventListener: jest.fn() },
    };
    const mockContract = { on: mockOnFn };

    const { ethers: ethersActual } =
      jest.requireActual<typeof import("ethers")>("ethers");
    // Cast through unknown so the typed spy stubs return the expected type
    const providerStub = mockProvider as unknown as ethers.WebSocketProvider;
    const contractStub = mockContract as unknown as ethers.Contract;
    jest
      .spyOn(ethersActual, "WebSocketProvider")
      .mockImplementationOnce(() => providerStub);
    jest.spyOn(ethersActual, "Contract").mockImplementation(() => contractStub);

    await service.connectAndListen();

    expect(mockProvider.getBlockNumber).toHaveBeenCalled();
    expect(mockOnFn).toHaveBeenCalledWith("Sold", expect.any(Function));
    expect(mockOnFn).toHaveBeenCalledWith("Transfer", expect.any(Function));
  });

  it("connectAndListen warns but continues when MARKETPLACE_ADDRESS is not set", async () => {
    process.env.WS_RPC_URL = "ws://localhost:8545";
    delete process.env.MARKETPLACE_ADDRESS;
    process.env.TRI_TOKEN_ADDRESS = "0xtri";
    const { service } = makeService();

    const mockOnFn = jest.fn().mockResolvedValue(undefined);
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(100),
      websocket: { addEventListener: jest.fn() },
    };
    const mockContract = { on: mockOnFn };

    const { ethers: ethersActual } =
      jest.requireActual<typeof import("ethers")>("ethers");
    const providerStub = mockProvider as unknown as ethers.WebSocketProvider;
    const contractStub = mockContract as unknown as ethers.Contract;
    jest
      .spyOn(ethersActual, "WebSocketProvider")
      .mockImplementationOnce(() => providerStub);
    jest.spyOn(ethersActual, "Contract").mockImplementation(() => contractStub);

    await service.connectAndListen();

    // Only TRI.Transfer subscribed — not Marketplace.Sold
    expect(mockOnFn).toHaveBeenCalledWith("Transfer", expect.any(Function));
    expect(mockOnFn).not.toHaveBeenCalledWith("Sold", expect.any(Function));
  });

  // ── handleMarketplaceSold ─────────────────────────────────────────────────

  it("handleMarketplaceSold logs seller disposal + buyer acquisition (no TRI addr set)", async () => {
    delete process.env.TRI_TOKEN_ADDRESS;
    const { taxService, svc } = makeService();
    svc.provider = {
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1_700_000_000 }),
    };

    await svc.handleMarketplaceSold(
      "0xSeller",
      "0xBuyer",
      "0xAsset",
      BigInt(42),
      ethers.parseEther("1.5"),
      ethers.parseEther("0.05"),
      { blockNumber: 100, transactionHash: "0xtxhash" },
    );

    // 2 events: seller disposal + buyer NFT acquisition (TRI disposal skipped — no TRI addr)
    expect(taxService.logEvent).toHaveBeenCalledTimes(2);
    expect(taxService.logEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "disposal",
        userAddress: "0xseller",
        tokenId: 42,
      }),
    );
    expect(taxService.logEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "acquisition",
        userAddress: "0xbuyer",
        feeUSD: 0,
      }),
    );
  });

  it("handleMarketplaceSold logs 3 events including buyer TRI disposal when TRI_TOKEN_ADDRESS is set", async () => {
    process.env.TRI_TOKEN_ADDRESS = "0xtritoken";
    const { taxService, svc } = makeService();
    svc.provider = {
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1_700_000_000 }),
    };

    await svc.handleMarketplaceSold(
      "0xSeller",
      "0xBuyer",
      "0xAsset",
      BigInt(7),
      ethers.parseEther("2.0"),
      ethers.parseEther("0.1"),
      { blockNumber: 101, transactionHash: "0xtxhash2" },
    );

    // 3 events: seller disposal + buyer NFT acquisition + buyer TRI disposal
    expect(taxService.logEvent).toHaveBeenCalledTimes(3);
    expect(taxService.logEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "disposal",
        userAddress: "0xbuyer",
        assetAddress: "0xtritoken",
      }),
    );
  });

  // ── handleTriTransfer ─────────────────────────────────────────────────────

  it("handleTriTransfer skips mint events (from = zero address)", async () => {
    const { taxService, svc } = makeService();
    const ZERO = "0x0000000000000000000000000000000000000000";

    await svc.handleTriTransfer(ZERO, "0xto", BigInt(100), {
      blockNumber: 1,
      transactionHash: "0x1",
    });

    expect(taxService.logEvent).not.toHaveBeenCalled();
  });

  it("handleTriTransfer skips burn events (to = zero address)", async () => {
    const { taxService, svc } = makeService();
    const ZERO = "0x0000000000000000000000000000000000000000";

    await svc.handleTriTransfer("0xfrom", ZERO, BigInt(100), {
      blockNumber: 1,
      transactionHash: "0x1",
    });

    expect(taxService.logEvent).not.toHaveBeenCalled();
  });

  it("handleTriTransfer logs disposal and acquisition for normal transfers", async () => {
    process.env.TRI_TOKEN_ADDRESS = "0xtriaddr";
    const { taxService, svc } = makeService();
    svc.provider = {
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1_700_000_000 }),
    };

    await svc.handleTriTransfer("0xFrom", "0xTo", ethers.parseEther("50"), {
      blockNumber: 200,
      transactionHash: "0xtx2",
    });

    expect(taxService.logEvent).toHaveBeenCalledTimes(2);
    expect(taxService.logEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "disposal", userAddress: "0xfrom" }),
    );
    expect(taxService.logEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "acquisition", userAddress: "0xto" }),
    );
  });

  // ── scheduleReconnect ─────────────────────────────────────────────────────

  it("scheduleReconnect does not schedule when already destroyed", () => {
    const { svc } = makeService();
    jest.useFakeTimers();
    svc.destroyed = true;
    svc.scheduleReconnect();
    expect(svc.reconnectTimer).toBeNull();
  });

  it("scheduleReconnect does not double-schedule when a timer is already pending", () => {
    const { svc } = makeService();
    jest.useFakeTimers();
    const firstTimer = setTimeout(() => {}, 99_999);
    svc.reconnectTimer = firstTimer;
    svc.scheduleReconnect();
    expect(svc.reconnectTimer).toBe(firstTimer);
  });

  it("scheduleReconnect doubles the reconnect delay (exponential back-off)", () => {
    const { service, svc } = makeService();
    jest.useFakeTimers();
    jest.spyOn(service, "connectAndListen").mockResolvedValue(undefined);
    const initial = svc.reconnectDelayMs;
    svc.scheduleReconnect();
    expect(svc.reconnectDelayMs).toBe(initial * 2);
  });

  it("scheduleReconnect caps delay at MAX_RECONNECT_DELAY_MS (60 s)", () => {
    const { service, svc } = makeService();
    jest.useFakeTimers();
    jest.spyOn(service, "connectAndListen").mockResolvedValue(undefined);
    svc.reconnectDelayMs = 60_000;
    svc.scheduleReconnect();
    expect(svc.reconnectDelayMs).toBe(60_000);
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  it("disconnect removes all listeners and destroys the provider", async () => {
    const { svc } = makeService();
    const removeListeners = jest.fn().mockResolvedValue(undefined);
    const destroy = jest.fn().mockResolvedValue(undefined);
    svc.marketplaceContract = { removeAllListeners: removeListeners };
    svc.triContract = { removeAllListeners: removeListeners };
    svc.provider = { getBlock: jest.fn(), destroy };

    await svc.disconnect();

    expect(removeListeners).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(svc.marketplaceContract).toBeNull();
    expect(svc.triContract).toBeNull();
    expect(svc.provider).toBeNull();
  });

  it("disconnect silently ignores cleanup errors", async () => {
    const { svc } = makeService();
    svc.marketplaceContract = {
      removeAllListeners: jest.fn().mockRejectedValue(new Error("ws error")),
    };
    await expect(svc.disconnect()).resolves.toBeUndefined();
  });

  // ── getBlockTimestamp ─────────────────────────────────────────────────────

  it("getBlockTimestamp converts block.timestamp to a Date", async () => {
    const { svc } = makeService();
    svc.provider = {
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1_700_000_000 }),
    };
    const result = await svc.getBlockTimestamp(123);
    expect(result).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("getBlockTimestamp returns current Date when block is null", async () => {
    const { svc } = makeService();
    svc.provider = { getBlock: jest.fn().mockResolvedValue(null) };
    const before = Date.now();
    const result = await svc.getBlockTimestamp(123);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("getBlockTimestamp returns current Date when provider throws", async () => {
    const { svc } = makeService();
    svc.provider = {
      getBlock: jest.fn().mockRejectedValue(new Error("rpc error")),
    };
    const before = Date.now();
    const result = await svc.getBlockTimestamp(123);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
  });
});
