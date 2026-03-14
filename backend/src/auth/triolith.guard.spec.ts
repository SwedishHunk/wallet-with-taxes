import { TriolithGuard } from "./triolith.guard";

describe("TriolithGuard", () => {
  it("allows platform admin", () => {
    const guard = new TriolithGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isAdmin: true } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("denies non-admin user", () => {
    const guard = new TriolithGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isAdmin: false } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(false);
  });

  it("denies missing user", () => {
    const guard = new TriolithGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: undefined }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(false);
  });
});
