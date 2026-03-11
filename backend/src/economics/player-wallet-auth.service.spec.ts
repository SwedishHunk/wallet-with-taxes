import { UnauthorizedException } from "@nestjs/common";
import { HDNodeWallet, Wallet } from "ethers";
import { PlayerWalletAuthService } from "./player-wallet-auth.service";

describe("PlayerWalletAuthService", () => {
  let service: PlayerWalletAuthService;
  let wallet: HDNodeWallet;

  beforeEach(() => {
    service = new PlayerWalletAuthService();
    wallet = Wallet.createRandom();
  });

  it("issues a nonce and verifies a matching signature", async () => {
    const issued = service.issueNonce(wallet.address, "session", "game-1");
    const signature = await wallet.signMessage(issued.message);

    const verified = service.verifySignedRequest({
      walletAddress: wallet.address,
      nonce: issued.nonce,
      signature,
      purpose: "session",
      gameId: "game-1",
    });

    expect(verified).toEqual({
      walletAddress: wallet.address.toLowerCase(),
      purpose: "session",
      gameId: "game-1",
    });
  });

  it("rejects replaying a consumed nonce", async () => {
    const issued = service.issueNonce(wallet.address, "economic_event", "game-1");
    const signature = await wallet.signMessage(issued.message);

    service.verifySignedRequest({
      walletAddress: wallet.address,
      nonce: issued.nonce,
      signature,
      purpose: "economic_event",
      gameId: "game-1",
    });

    expect(() =>
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "economic_event",
        gameId: "game-1",
      }),
    ).toThrow(UnauthorizedException);
  });
});
