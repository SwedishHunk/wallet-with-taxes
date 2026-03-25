import { UsersController } from "./users.controller";

function req(user: { id: string }) {
  return { user } as never;
}

function mockRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as never;
}

describe("UsersController", () => {
  const service = {
    signup: jest.fn(),
    login: jest.fn(),
    selectStudio: jest.fn(),
    linkWallet: jest.fn(),
    findById: jest.fn(),
    getStudiosForUser: jest.fn(),
    getMemberSession: jest.fn(),
  };
  const controller = new UsersController(service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates signup and strips token from response", async () => {
    service.signup.mockResolvedValueOnce({
      token: "x",
      studio: { studioId: "s1" },
    });
    const res = mockRes();
    const result = await controller.signup(
      {
        email: "a@b.com",
        password: "pw",
        studioName: "S",
        gdprConsent: true,
      } as never,
      res,
    );
    expect(result).toEqual({ studio: { studioId: "s1" } });
    expect(
      (res as unknown as { cookie: jest.Mock }).cookie,
    ).toHaveBeenCalledWith(
      "access_token",
      "x",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(service.signup).toHaveBeenCalledWith("a@b.com", "pw", "S", true);
  });

  it("delegates login and strips token from response", async () => {
    service.login.mockResolvedValueOnce({
      token: "x",
      user: { id: "u1" },
      studios: [{ id: "s1" }],
    });
    const res = mockRes();
    const result = await controller.login(
      { email: "a@b.com", password: "pw", studioId: "s1" } as never,
      res,
    );
    expect(result).toEqual({ user: { id: "u1" }, studios: [{ id: "s1" }] });
    expect(
      (res as unknown as { cookie: jest.Mock }).cookie,
    ).toHaveBeenCalledWith(
      "access_token",
      "x",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(service.login).toHaveBeenCalledWith("a@b.com", "pw", "s1");
  });

  it("delegates select-studio and strips token from response", async () => {
    service.selectStudio.mockResolvedValueOnce({
      token: "studio-tok",
      studioId: "s1",
      studioName: "Studio 1",
      role: "owner",
    });
    const res = mockRes();
    const result = await controller.selectStudio(
      { studioId: "s1" } as never,
      req({ id: "u1" }),
      res,
    );
    expect(result).toEqual({
      studioId: "s1",
      studioName: "Studio 1",
      role: "owner",
    });
    expect(
      (res as unknown as { cookie: jest.Mock }).cookie,
    ).toHaveBeenCalledWith(
      "access_token",
      "studio-tok",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("logout clears cookie", () => {
    const res = mockRes();
    const result = controller.logout(res);
    expect(result).toEqual({ success: true });
    expect(
      (res as unknown as { clearCookie: jest.Mock }).clearCookie,
    ).toHaveBeenCalledWith(
      "access_token",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("delegates link wallet", async () => {
    service.linkWallet.mockResolvedValueOnce({ ok: true });
    await expect(
      controller.linkWallet({
        email: "a@b.com",
        walletAddress: "0xabc",
        signature: "0xsig",
      } as never),
    ).resolves.toEqual({ ok: true });
    expect(service.linkWallet).toHaveBeenCalledWith(
      "a@b.com",
      "0xabc",
      "0xsig",
    );
  });

  it("delegates profile/studios/member-session reads", async () => {
    service.findById.mockResolvedValueOnce({ id: "u1" });
    service.getStudiosForUser.mockResolvedValueOnce([{ id: "s1" }]);
    service.getMemberSession.mockResolvedValueOnce({ memberId: "m1" });

    await expect(controller.getProfile(req({ id: "u1" }))).resolves.toEqual({
      id: "u1",
    });
    await expect(controller.getStudios(req({ id: "u1" }))).resolves.toEqual([
      { id: "s1" },
    ]);
    await expect(
      controller.getMemberSession(req({ id: "u1" }), "s1"),
    ).resolves.toEqual({ memberId: "m1" });
  });
});
