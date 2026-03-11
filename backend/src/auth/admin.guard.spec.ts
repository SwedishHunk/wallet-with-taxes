import { AdminGuard } from "./admin.guard";

describe("AdminGuard", () => {
  it("allows admin user", () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "owner" } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("also allows role=admin", () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "admin" } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("denies non-admin user", () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "member" } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(false);
  });
});
