import { createHmac } from "crypto";
import {
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { KycService } from "./kyc.service";

function makeService(userRow: unknown = null) {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(userRow),
    update: jest.fn().mockResolvedValue({}),
  };
  const service = new KycService(userRepo as never);
  return { service, userRepo };
}

describe("KycService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    delete process.env.KYC_PROVIDER_KEY;
    delete process.env.KYC_WEBHOOK_SECRET;
  });

  // ── dev auto-approve mode ──────────────────────────────────────────────────

  it("initiateKyc auto-approves and marks verified in dev mode", async () => {
    const { service, userRepo } = makeService({ id: "u1" });
    delete process.env.KYC_PROVIDER_KEY;

    const result = await service.initiateKyc("u1");

    expect(result.autoApproved).toBe(true);
    expect(result.sessionId).toContain("dev-auto-approved");
    expect(userRepo.update).toHaveBeenCalledWith("u1", {
      kycStatus: "verified",
    });
  });

  it("initiateKyc throws NotFoundException when user not found", async () => {
    const { service } = makeService(null);

    await expect(service.initiateKyc("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── production mode ────────────────────────────────────────────────────────

  it("initiateKyc throws ServiceUnavailableException in prod mode (stub)", async () => {
    process.env.KYC_PROVIDER_KEY = "test-key";
    const { service } = makeService({ id: "u1" });

    await expect(service.initiateKyc("u1")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  // ── webhook handling ───────────────────────────────────────────────────────

  it("handleWebhook updates kycStatus for known user", async () => {
    const { service, userRepo } = makeService({ id: "u1" });

    const result = await service.handleWebhook({
      sessionId: "sess-1",
      userId: "u1",
      status: "verified",
    });

    expect(result.updated).toBe(true);
    expect(userRepo.update).toHaveBeenCalledWith("u1", {
      kycStatus: "verified",
    });
  });

  it("handleWebhook returns updated=false for unknown user", async () => {
    const { service, userRepo } = makeService(null);

    const result = await service.handleWebhook({
      sessionId: "sess-2",
      userId: "missing",
      status: "rejected",
    });

    expect(result.updated).toBe(false);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it("handleWebhook handles rejected status", async () => {
    const { service, userRepo } = makeService({ id: "u2" });

    await service.handleWebhook({
      sessionId: "sess-3",
      userId: "u2",
      status: "rejected",
    });

    expect(userRepo.update).toHaveBeenCalledWith("u2", {
      kycStatus: "rejected",
    });
  });

  // ── webhook signature verification ────────────────────────────────────────

  it("skips signature check when KYC_WEBHOOK_SECRET is not set (dev mode)", async () => {
    delete process.env.KYC_WEBHOOK_SECRET;
    const { service } = makeService({ id: "u1" });

    // No rawBody or signature — should not throw in dev mode
    await expect(
      service.handleWebhook({
        sessionId: "s1",
        userId: "u1",
        status: "verified",
      }),
    ).resolves.toMatchObject({ updated: true });
  });

  it("throws UnauthorizedException when secret is set but signature header is absent", async () => {
    process.env.KYC_WEBHOOK_SECRET = "test-secret";
    const { service } = makeService({ id: "u1" });

    await expect(
      service.handleWebhook(
        { sessionId: "s1", userId: "u1", status: "verified" },
        Buffer.from("{}"),
        undefined,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when secret is set but rawBody is absent", async () => {
    process.env.KYC_WEBHOOK_SECRET = "test-secret";
    const { service } = makeService({ id: "u1" });

    await expect(
      service.handleWebhook(
        { sessionId: "s1", userId: "u1", status: "verified" },
        undefined,
        "sha256=abc",
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when HMAC signature does not match", async () => {
    process.env.KYC_WEBHOOK_SECRET = "test-secret";
    const { service } = makeService({ id: "u1" });
    const rawBody = Buffer.from('{"userId":"u1","status":"verified"}');

    await expect(
      service.handleWebhook(
        { sessionId: "s1", userId: "u1", status: "verified" },
        rawBody,
        "sha256=badhash000000000000000000000000000000000000000000000000000000000",
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("accepts a valid HMAC-SHA256 signature (plain hex format)", async () => {
    const secret = "valid-secret-key";
    process.env.KYC_WEBHOOK_SECRET = secret;
    const { service } = makeService({ id: "u1" });
    const rawBody = Buffer.from('{"userId":"u1","status":"verified"}');
    const sig = createHmac("sha256", secret).update(rawBody).digest("hex");

    await expect(
      service.handleWebhook(
        { sessionId: "s1", userId: "u1", status: "verified" },
        rawBody,
        sig,
      ),
    ).resolves.toMatchObject({ updated: true });
  });

  it("accepts a valid HMAC-SHA256 signature (sha256= prefix format)", async () => {
    const secret = "valid-secret-key";
    process.env.KYC_WEBHOOK_SECRET = secret;
    const { service } = makeService({ id: "u1" });
    const rawBody = Buffer.from('{"userId":"u1","status":"verified"}');
    const sig = createHmac("sha256", secret).update(rawBody).digest("hex");

    await expect(
      service.handleWebhook(
        { sessionId: "s1", userId: "u1", status: "verified" },
        rawBody,
        `sha256=${sig}`,
      ),
    ).resolves.toMatchObject({ updated: true });
  });
});
