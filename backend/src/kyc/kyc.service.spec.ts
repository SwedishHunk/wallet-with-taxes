import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
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
});
