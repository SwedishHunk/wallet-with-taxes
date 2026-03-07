import { TaxController } from "./tax.controller";

describe("TaxController", () => {
  it("returns error payload when user query is missing in summary", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(controller.getSummary("")).resolves.toEqual({
      error: "Missing user address in query.",
    });
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it("delegates summary request to tax service", async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ ok: true }),
      exportEventsAsCSV: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await expect(controller.getSummary("0xabc")).resolves.toEqual({ ok: true });
    expect(service.getSummary).toHaveBeenCalledWith("0xabc");
  });

  it("returns 400 when user query is missing in export", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn(),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await controller.exportCSV("", res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Missing user address");
    expect(service.exportEventsAsCSV).not.toHaveBeenCalled();
  });

  it("delegates export request to tax service", async () => {
    const service = {
      getSummary: jest.fn(),
      exportEventsAsCSV: jest.fn().mockResolvedValue(undefined),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const controller = new TaxController(service as never);

    await controller.exportCSV("0xabc", res as never);
    expect(service.exportEventsAsCSV).toHaveBeenCalledWith("0xabc", res);
  });
});
