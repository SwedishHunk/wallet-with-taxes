import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";

const mockUserRepo = {
  findOne: jest.fn(),
};

describe("JwtStrategy", () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    jest.clearAllMocks();
    if (original === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = original;
    }
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => new JwtStrategy(mockUserRepo as never)).toThrow(
      "JWT_SECRET environment variable is required",
    );
  });

  it("maps payload fields in validate when user is active", async () => {
    process.env.JWT_SECRET = "test-secret";
    const strategy = new JwtStrategy(mockUserRepo as never);
    mockUserRepo.findOne.mockResolvedValue({ id: "u1", isSuspended: false });
    const payload = {
      id: "u1",
      email: "u@test.com",
      studioId: "s1",
      role: "owner" as const,
      isAdmin: false,
    };
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it("throws UnauthorizedException when user is suspended", async () => {
    process.env.JWT_SECRET = "test-secret";
    const strategy = new JwtStrategy(mockUserRepo as never);
    mockUserRepo.findOne.mockResolvedValue({ id: "u1", isSuspended: true });
    const payload = {
      id: "u1",
      email: "u@test.com",
      studioId: "s1",
      role: "owner" as const,
      isAdmin: false,
    };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when user not found", async () => {
    process.env.JWT_SECRET = "test-secret";
    const strategy = new JwtStrategy(mockUserRepo as never);
    mockUserRepo.findOne.mockResolvedValue(null);
    const payload = {
      id: "u1",
      email: "u@test.com",
      studioId: "s1",
      role: "owner" as const,
      isAdmin: false,
    };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
