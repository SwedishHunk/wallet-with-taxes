import { WalletsService } from "./wallets.service";
import { ethers } from "ethers";

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
};

describe("WalletsService", () => {
  let repo: MockRepo;
  let service: WalletsService;
  const originalRpcUrl = process.env.RPC_URL;

  beforeEach(() => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
    };
    service = new WalletsService(repo as never);
    delete process.env.RPC_URL;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalRpcUrl === undefined) {
      delete process.env.RPC_URL;
    } else {
      process.env.RPC_URL = originalRpcUrl;
    }
  });

  it("registerWallet persists owner and address", async () => {
    await service.registerWallet("0xowner", "0xwallet");

    expect(repo.create).toHaveBeenCalledWith({
      owner: "0xowner",
      address: "0xwallet",
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it("getWalletByOwner queries repository", async () => {
    repo.findOne.mockResolvedValueOnce({ owner: "0xowner" });
    await service.getWalletByOwner("0xowner");

    expect(repo.findOne).toHaveBeenCalledWith({ where: { owner: "0xowner" } });
  });

  it("getBalance returns 0 ETH when RPC_URL is missing", async () => {
    await expect(service.getBalance("0xwallet")).resolves.toEqual({
      address: "0xwallet",
      balance: "0 ETH",
    });
  });

  it("getBalance returns formatted balance from RPC provider", async () => {
    process.env.RPC_URL = "http://localhost:8545";
    const provider = { getBalance: jest.fn().mockResolvedValue(1500000000000000000n) };
    const providerSpy = jest
      .spyOn(ethers, "JsonRpcProvider")
      .mockImplementation(() => provider as never);

    await expect(service.getBalance("0xwallet")).resolves.toEqual({
      address: "0xwallet",
      balance: "1.5 ETH",
    });
    expect(providerSpy).toHaveBeenCalledWith("http://localhost:8545");
    expect(provider.getBalance).toHaveBeenCalledWith("0xwallet");
  });

  it("getBalance returns unavailable marker on provider failure", async () => {
    process.env.RPC_URL = "http://localhost:8545";
    jest
      .spyOn(ethers, "JsonRpcProvider")
      .mockImplementation(() => ({ getBalance: jest.fn().mockRejectedValue(new Error("boom")) }) as never);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(service.getBalance("0xwallet")).resolves.toEqual({
      address: "0xwallet",
      balance: "0 ETH (unavailable)",
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("getAssets returns mocked holdings", () => {
    const result = service.getAssets("0xwallet");
    expect(result.address).toBe("0xwallet");
    expect(result.assets).toHaveLength(2);
  });

  it("getAssetDetail returns mocked NFT metadata", () => {
    const result = service.getAssetDetail("0xowner", "42");
    expect(result).toEqual(
      expect.objectContaining({
        tokenId: "42",
        owner: "0xowner",
        type: "ERC721",
      }),
    );
  });
});
