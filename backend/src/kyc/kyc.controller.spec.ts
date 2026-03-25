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

  it("webhook delegates to kycService.handleWebhook", async () => {
    const { controller, kycService } = makeController();
    const payload = {
      sessionId: "s1",
      userId: "u1",
      status: "verified" as const,
    };

    const result = await controller.webhook(payload);

    expect(kycService.handleWebhook).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ updated: true });
  });
});
