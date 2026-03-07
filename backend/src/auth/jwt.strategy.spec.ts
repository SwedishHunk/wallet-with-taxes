import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = original;
    }
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => new JwtStrategy()).toThrow(
      "JWT_SECRET environment variable is required",
    );
  });

  it("maps payload fields in validate", () => {
    process.env.JWT_SECRET = "test-secret";
    const strategy = new JwtStrategy();
    const payload = {
      id: "u1",
      email: "u@test.com",
      studioId: "s1",
      role: "owner" as const,
    };
    expect(strategy.validate(payload)).toEqual(payload);
  });
});
