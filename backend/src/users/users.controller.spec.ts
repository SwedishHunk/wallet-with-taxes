import { UsersController } from "./users.controller";

function req(user: { id: string }) {
  return { user } as never;
}

describe("UsersController", () => {
  const service = {
    signup: jest.fn(),
    login: jest.fn(),
    linkWallet: jest.fn(),
    findById: jest.fn(),
    getStudiosForUser: jest.fn(),
    getMemberSession: jest.fn(),
  };
  const controller = new UsersController(service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates signup", async () => {
    service.signup.mockResolvedValueOnce({ token: "x" });
    await expect(
      controller.signup({
        email: "a@b.com",
        password: "pw",
        studioName: "S",
      } as never),
    ).resolves.toEqual({ token: "x" });
    expect(service.signup).toHaveBeenCalledWith("a@b.com", "pw", "S");
  });

  it("delegates login", async () => {
    service.login.mockResolvedValueOnce({ token: "x" });
    await expect(
      controller.login({
        email: "a@b.com",
        password: "pw",
        studioId: "s1",
      } as never),
    ).resolves.toEqual({ token: "x" });
    expect(service.login).toHaveBeenCalledWith("a@b.com", "pw", "s1");
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
