import { WalletsController } from "./wallets.controller";

describe("WalletsController", () => {
  const service = {
    registerWallet: jest.fn(),
    getBalance: jest.fn(),
    getAssets: jest.fn(),
    getAssetDetail: jest.fn(),
  };
  const controller = new WalletsController(service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("register delegates owner and address", async () => {
    service.registerWallet.mockResolvedValueOnce({ ok: true });
    await expect(
      controller.register({ owner: "0xowner", address: "0xwallet" }),
    ).resolves.toEqual({ ok: true });
    expect(service.registerWallet).toHaveBeenCalledWith("0xowner", "0xwallet");
  });

  it("getBalance delegates query argument", async () => {
    service.getBalance.mockResolvedValueOnce({ balance: "0 ETH" });
    await expect(controller.getBalance("0xwallet")).resolves.toEqual({
      balance: "0 ETH",
    });
    expect(service.getBalance).toHaveBeenCalledWith("0xwallet");
  });

  it("getAssets delegates query argument", () => {
    service.getAssets.mockReturnValueOnce({ assets: [] });
    expect(controller.getAssets("0xwallet")).toEqual({ assets: [] });
    expect(service.getAssets).toHaveBeenCalledWith("0xwallet");
  });

  it("getAssetDetail delegates param and query arguments", () => {
    service.getAssetDetail.mockReturnValueOnce({ tokenId: "1" });
    expect(controller.getAssetDetail("1", "0xwallet")).toEqual({
      tokenId: "1",
    });
    expect(service.getAssetDetail).toHaveBeenCalledWith("0xwallet", "1");
  });
});
