/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AdminDevService } from "./admin-dev.service";

type Repo = {
  findOne: jest.Mock;
};

describe("AdminDevService", () => {
  let usersService: {
    signup: jest.Mock;
    login: jest.Mock;
    getMemberSession: jest.Mock;
  };
  let platformService: { createGameForUser: jest.Mock };
  let userRepo: Repo;
  let studioRepo: Repo;
  let gameRepo: Repo;
  let service: AdminDevService;

  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DEV_BOOTSTRAP_KEY: process.env.DEV_BOOTSTRAP_KEY,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  };

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.DEV_BOOTSTRAP_KEY = "dev-secret";
    delete process.env.ADMIN_API_KEY;

    usersService = {
      signup: jest.fn(),
      login: jest.fn().mockResolvedValue({
        token: "jwt",
        user: { id: "u1", studioId: "s1", isAdmin: false },
      }),
      getMemberSession: jest.fn().mockResolvedValue({ memberId: "m1" }),
    };
    platformService = {
      createGameForUser: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "u1" }),
    };
    studioRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "s1", name: "Dev Studio" }),
    };
    gameRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: "g1",
        name: "Dev Game",
        slug: "dev-game",
      }),
    };

    service = new AdminDevService(
      usersService as never,
      platformService as never,
      userRepo as never,
      studioRepo as never,
      gameRepo as never,
    );
  });

  afterAll(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  it("rejects bootstrap when the key is missing", async () => {
    await expect(service.bootstrap({}, undefined)).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid dev bootstrap key",
    });
  });

  it("allows local bootstrap when no key is configured", async () => {
    delete process.env.DEV_BOOTSTRAP_KEY;

    const result = await service.bootstrap({}, undefined, {
      ip: "::1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        token: "jwt",
        studio: expect.objectContaining({ studioId: "s1" }),
      }),
    );
  });

  it("rejects bootstrap without key for non-local requests", async () => {
    delete process.env.DEV_BOOTSTRAP_KEY;

    await expect(
      service.bootstrap({}, undefined, { ip: "192.168.1.100" }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: "Dev bootstrap key is not configured",
    });
  });

  it("rejects bootstrap in production", async () => {
    process.env.NODE_ENV = "production";

    await expect(service.bootstrap({}, "dev-secret")).rejects.toMatchObject({
      statusCode: 403,
      message: "Dev bootstrap is disabled in production",
    });
  });

  it("allows bootstrap when the configured key matches", async () => {
    const result = await service.bootstrap({}, "dev-secret");

    expect(result).toEqual(
      expect.objectContaining({
        token: "jwt",
        studio: expect.objectContaining({ studioId: "s1" }),
        game: expect.objectContaining({ gameId: "g1" }),
      }),
    );
    expect(usersService.login).toHaveBeenCalled();
  });

  it("falls back to a free studio name when the default dev name already exists", async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    studioRepo.findOne
      .mockResolvedValueOnce({ id: "studio-dev-name-taken" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "s1", name: "dev-owner@triolith.local" });

    const result = await service.bootstrap({}, "dev-secret");

    expect(usersService.signup).toHaveBeenCalledWith(
      "dev-owner@triolith.local",
      "DevPass123!",
      "dev-owner@triolith.local",
    );
    expect(result.studio.studioId).toBe("s1");
  });
});
