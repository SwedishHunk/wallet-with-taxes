import { AppController } from "./app.controller";

describe("AppController", () => {
  it("delegates health check to app service", () => {
    const service = { getHealthStatus: jest.fn().mockReturnValue("OK") };
    const controller = new AppController(service as never);
    expect(controller.healthCheck()).toBe("OK");
    expect(service.getHealthStatus).toHaveBeenCalled();
  });
});
