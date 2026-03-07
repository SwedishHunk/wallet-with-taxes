import { AdminGuard } from "./admin.guard";

describe("AdminGuard", () => {
  it("allows admin user", () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isAdmin: true } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("denies non-admin user", () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isAdmin: false } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(false);
  });
});
