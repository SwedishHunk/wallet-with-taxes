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
    const issued = service.issueNonce(
      wallet.address,
      "economic_event",
      "game-1",
    );
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

  it("rejects an expired nonce", async () => {
    const issued = service.issueNonce(wallet.address, "session", "game-1");
    const signature = await wallet.signMessage(issued.message);

    // Force expiry by manipulating the internal map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (service as any).pendingNonces as Map<
      string,
      { expiresAt: number }
    >;
    for (const [k, v] of map.entries()) {
      map.set(k, { ...v, expiresAt: Date.now() - 1 });
    }

    expect(() =>
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "session",
        gameId: "game-1",
      }),
    ).toThrow(UnauthorizedException);
  });

  it("rejects a game scope mismatch", async () => {
    const issued = service.issueNonce(wallet.address, "session", "game-1");
    const signature = await wallet.signMessage(issued.message);

    expect(() =>
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "session",
        gameId: "game-2",
      }),
    ).toThrow(UnauthorizedException);
  });

  it("rejects an invalid signature", async () => {
    const issued = service.issueNonce(wallet.address, "session", "game-1");
    const otherWallet = Wallet.createRandom();
    const badSignature = await otherWallet.signMessage(issued.message);

    expect(() =>
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature: badSignature,
        purpose: "session",
        gameId: "game-1",
      }),
    ).toThrow(UnauthorizedException);
  });

  it("rejects an invalid wallet address", () => {
    expect(() => service.issueNonce("not-an-address", "session")).toThrow();
  });
});
