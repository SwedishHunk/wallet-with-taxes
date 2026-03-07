import { AppException } from "./app-exception";

describe("AppException", () => {
  it("uses explicit status and code", () => {
    const ex = new AppException("boom", 418, "TEAPOT");
    expect(ex.message).toBe("boom");
    expect(ex.statusCode).toBe(418);
    expect(ex.code).toBe("TEAPOT");
  });

  it("defaults status code to 400", () => {
    const ex = new AppException("bad");
    expect(ex.statusCode).toBe(400);
  });
});
