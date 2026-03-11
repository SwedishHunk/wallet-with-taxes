import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  it("returns user when present", () => {
    const guard = new JwtAuthGuard();
    const user = { id: "u1" };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it("throws unauthorized when user missing", () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, null)).toThrow(
      UnauthorizedException,
    );
  });

  it("throws unauthorized when error exists", () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(new Error("x"), { id: "u1" })).toThrow(
      UnauthorizedException,
    );
  });
});
