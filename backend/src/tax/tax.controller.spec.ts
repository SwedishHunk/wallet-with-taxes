import {
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ApiTaxController, TaxController } from "./tax.controller";

// Helper: build a mock Express Request with optional JwtUser on req.user
function mockReq(
  overrides: {
    id?: string;
    walletAddress?: string;
    isAdmin?: boolean;
  } = {},
) {
  return {
    user: {
      id: overrides.id ?? "u1",
      walletAddress: overrides.walletAddress ?? "0xabc",
      isAdmin: overrides.isAdmin ?? false,
    },
  } as never;
}

describe("TaxController", () => {
  it("returns error payload when user query is missing in summary", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(
      controller.getSummary("", undefined, mockReq({ walletAddress: "" })),
    ).resolves.toEqual({ error: "Missing user address in query." });
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it("delegates summary request to tax service when wallet matches", async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ ok: true }),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(
      controller.getSummary(
        "0xabc",
        undefined,
        mockReq({ walletAddress: "0xabc" }),
      ),
    ).resolves.toEqual({ ok: true });
    expect(service.getSummary).toHaveBeenCalledWith("0xabc", undefined);
  });

  it("allows admin to query any wallet address", async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ ok: true }),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(
      controller.getSummary(
        "0xother",
        undefined,
        mockReq({ walletAddress: "0xadmin", isAdmin: true }),
      ),
    ).resolves.toEqual({ ok: true });
    expect(service.getSummary).toHaveBeenCalledWith("0xother", undefined);
  });

  it("throws ForbiddenException when wallet does not match and not admin", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(
      controller.getSummary(
        "0xother",
        undefined,
        mockReq({ walletAddress: "0xabc", isAdmin: false }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it("returns 400 when user query is missing in export", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new TaxController(service as never);

    await controller.exportCSV("", undefined, mockReq(), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Missing user address");
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });

  it("delegates export request to tax service when wallet matches", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn().mockResolvedValue(undefined),
      checkExportReadiness: jest.fn().mockResolvedValue({
        blocked: false,
        totalCount: 5,
        missingCount: 0,
        missingRatio: 0,
      }),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new TaxController(service as never);

    await controller.exportCSV(
      "0xabc",
      undefined,
      mockReq({ walletAddress: "0xabc" }),
      res as never,
    );
    expect(service.exportEventsAsCSV).toHaveBeenCalledWith(
      "0xabc",
      res,
      undefined,
    );
  });

  it("throws ForbiddenException on export when wallet does not match", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new TaxController(service as never);

    await expect(
      controller.exportCSV(
        "0xother",
        undefined,
        mockReq({ walletAddress: "0xabc", isAdmin: false }),
        res as never,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });

  it("throws UnprocessableEntityException when >5% events have missing valuations", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn().mockResolvedValue({
        blocked: true,
        totalCount: 100,
        missingCount: 10,
        missingRatio: 0.1,
      }),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new TaxController(service as never);

    await expect(
      controller.exportCSV(
        "0xabc",
        undefined,
        mockReq({ walletAddress: "0xabc" }),
        res as never,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });

  it("admin with force=true bypasses the missing-valuation gate", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn().mockResolvedValue(undefined),
      checkExportReadiness: jest.fn(),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new TaxController(service as never);

    await controller.exportCSV(
      "0xabc",
      undefined,
      mockReq({ walletAddress: "0xabc", isAdmin: true }),
      res as never,
      "true",
    );

    // Gate was skipped — checkExportReadiness never called
    expect(service.checkExportReadiness).not.toHaveBeenCalled();
    expect(service.exportEventsAsCSV).toHaveBeenCalled();
  });
});

describe("ApiTaxController", () => {
  it("getSummary returns error object when user is missing", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new ApiTaxController(service as never);
    const result = await controller.getSummary("", undefined, {} as never);
    expect(result).toEqual({ error: "Missing user address in query." });
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it("getSummary delegates to tax service with lowercased address", async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ gains: 0 }),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const controller = new ApiTaxController(service as never);
    const result = await controller.getSummary(
      "0xABC",
      undefined,
      mockReq({ walletAddress: "0xabc" }),
    );
    expect(service.getSummary).toHaveBeenCalledWith("0xabc", undefined);
    expect(result).toEqual({ gains: 0 });
  });

  it("exportCSV returns 400 when user is missing", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn(),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new ApiTaxController(service as never);
    await controller.exportCSV("", undefined, {} as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Missing user address");
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });

  it("exportCSV delegates to tax service with lowercased address", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn().mockResolvedValue(undefined),
      checkExportReadiness: jest.fn().mockResolvedValue({
        blocked: false,
        totalCount: 3,
        missingCount: 0,
        missingRatio: 0,
      }),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new ApiTaxController(service as never);
    await controller.exportCSV(
      "0xABC",
      undefined,
      mockReq({ walletAddress: "0xabc" }),
      res as never,
    );
    expect(service.exportEventsAsCSV).toHaveBeenCalledWith(
      "0xabc",
      res,
      undefined,
    );
  });

  it("exportCSV throws UnprocessableEntityException when gate is triggered", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
      checkExportReadiness: jest.fn().mockResolvedValue({
        blocked: true,
        totalCount: 50,
        missingCount: 40,
        missingRatio: 0.8,
      }),
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const controller = new ApiTaxController(service as never);

    await expect(
      controller.exportCSV(
        "0xabc",
        undefined,
        mockReq({ walletAddress: "0xabc" }),
        res as never,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });
});
