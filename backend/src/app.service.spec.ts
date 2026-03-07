import { AppService } from "./app.service";

describe("AppService", () => {
  it("returns health status", () => {
    const service = new AppService();
    expect(service.getHealthStatus()).toBe("OK");
  });
});
