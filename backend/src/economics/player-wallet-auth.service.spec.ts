import { UnauthorizedException } from "@nestjs/common";
import { HDNodeWallet, Wallet } from "ethers";
import { PlayerWalletAuthService } from "./player-wallet-auth.service";
import { PlayerNonce } from "./entities/player-nonce.entity";

/**
 * In-memory mock repository that mimics the TypeORM Repository<PlayerNonce>
 * interface used by PlayerWalletAuthService.
 */
function makeNonceRepo() {
  const db = new Map<string, PlayerNonce>();

  return {
    _db: db,
    create: jest.fn(
      (data: Partial<PlayerNonce>) => ({ ...data }) as PlayerNonce,
    ),
    save: jest.fn().mockImplementation((nonce: PlayerNonce) => {
      db.set(nonce.key, nonce);
      return Promise.resolve(nonce);
    }),
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(db.get(where.key) ?? null),
      ),
    delete: jest.fn().mockImplementation((keyOrQuery: string | object) => {
      if (typeof keyOrQuery === "string") {
        db.delete(keyOrQuery);
      }
      // LessThan cleanup queries are no-ops in tests
      return Promise.resolve();
    }),
  };
}

describe("PlayerWalletAuthService", () => {
  let service: PlayerWalletAuthService;
  let wallet: HDNodeWallet;
  let nonceRepo: ReturnType<typeof makeNonceRepo>;

  beforeEach(() => {
    nonceRepo = makeNonceRepo();
    service = new PlayerWalletAuthService(nonceRepo as never);
    wallet = Wallet.createRandom();
  });

  it("issues a nonce and verifies a matching signature", async () => {
    const issued = await service.issueNonce(
      wallet.address,
      "session",
      "game-1",
    );
    const signature = await wallet.signMessage(issued.message);

    const verified = await service.verifySignedRequest({
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
    const issued = await service.issueNonce(
      wallet.address,
      "economic_event",
      "game-1",
    );
    const signature = await wallet.signMessage(issued.message);

    // First use succeeds
    await service.verifySignedRequest({
      walletAddress: wallet.address,
      nonce: issued.nonce,
      signature,
      purpose: "economic_event",
      gameId: "game-1",
    });

    // Replay is rejected
    await expect(
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "economic_event",
        gameId: "game-1",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an expired nonce", async () => {
    const issued = await service.issueNonce(
      wallet.address,
      "session",
      "game-1",
    );
    const signature = await wallet.signMessage(issued.message);

    // Manually expire the stored nonce
    const key = `${wallet.address.toLowerCase()}:session:${issued.nonce}`;
    const stored = nonceRepo._db.get(key);
    if (stored) stored.expiresAt = new Date(Date.now() - 1);

    await expect(
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "session",
        gameId: "game-1",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a game scope mismatch", async () => {
    const issued = await service.issueNonce(
      wallet.address,
      "session",
      "game-1",
    );
    const signature = await wallet.signMessage(issued.message);

    await expect(
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature,
        purpose: "session",
        gameId: "game-2",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an invalid signature", async () => {
    const issued = await service.issueNonce(
      wallet.address,
      "session",
      "game-1",
    );
    const otherWallet = Wallet.createRandom();
    const badSignature = await otherWallet.signMessage(issued.message);

    await expect(
      service.verifySignedRequest({
        walletAddress: wallet.address,
        nonce: issued.nonce,
        signature: badSignature,
        purpose: "session",
        gameId: "game-1",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an invalid wallet address", async () => {
    await expect(
      service.issueNonce("not-an-address", "session"),
    ).rejects.toThrow();
  });
});
