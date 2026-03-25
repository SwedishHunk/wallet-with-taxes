import { KycController } from "./kyc.controller";

function makeController() {
  const kycService = {
    initiateKyc: jest.fn().mockResolvedValue({
      sessionId: "dev-sess-1",
      redirectUrl: "/kyc/complete",
      autoApproved: true,
    }),
    handleWebhook: jest.fn().mockResolvedValue({ updated: true }),
  };
  const controller = new KycController(kycService as never);
  return { controller, kycService };
}

describe("KycController", () => {
  it("initiate delegates to kycService.initiateKyc with user id", async () => {
    const { controller, kycService } = makeController();
    const req = { user: { id: "u1" } } as never;

    const result = await controller.initiate(req);

    expect(kycService.initiateKyc).toHaveBeenCalledWith("u1");
    expect(result).toMatchObject({
      sessionId: "dev-sess-1",
      autoApproved: true,
    });
  });

  it("webhook passes payload, rawBody and signature to kycService.handleWebhook", async () => {
    const { controller, kycService } = makeController();
    const payload = {
      sessionId: "s1",
      userId: "u1",
      status: "verified" as const,
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = "sha256=abc123";

    const result = await controller.webhook(signature, rawBody, payload);

    expect(kycService.handleWebhook).toHaveBeenCalledWith(
      payload,
      rawBody,
      signature,
    );
    expect(result).toEqual({ updated: true });
  });

  it("webhook works without a signature header (dev mode pass-through)", async () => {
    const { controller, kycService } = makeController();
    const payload = {
      sessionId: "s2",
      userId: "u2",
      status: "rejected" as const,
    };

    const result = await controller.webhook(
      undefined,
      Buffer.from("{}"),
      payload,
    );

    expect(kycService.handleWebhook).toHaveBeenCalledWith(
      payload,
      expect.any(Buffer),
      undefined,
    );
    expect(result).toEqual({ updated: true });
  });
});
