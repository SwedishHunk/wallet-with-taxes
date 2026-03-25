import { DataRetentionService } from "./data-retention.service";

function makeUser(
  partial: Partial<{
    id: string;
    walletAddress: string;
    lastLoginAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "u1",
    walletAddress: "0xabc",
    lastLoginAt: null,
    createdAt: new Date("2019-01-01"),
    ...partial,
  };
}

function makeService(
  opts: {
    users?: unknown[];
    taxCount?: number;
    taxTotal?: number;
  } = {},
) {
  const { users = [], taxCount = 0, taxTotal = 0 } = opts;

  const userRepo = {
    find: jest.fn().mockResolvedValue(users),
    update: jest.fn().mockResolvedValue({}),
  };
  const taxRepo = {
    count: jest
      .fn()
      .mockResolvedValueOnce(taxCount) // older events
      .mockResolvedValueOnce(taxTotal), // total events
  };

  const service = new DataRetentionService(userRepo as never, taxRepo as never);
  return { service, userRepo, taxRepo };
}

describe("DataRetentionService", () => {
  it("runManually returns zeros when no inactive users exist", async () => {
    const { service } = makeService({ users: [] });
    const result = await service.runManually();
    expect(result).toEqual({ candidatesFound: 0, anonymized: 0 });
  });

  it("anonymizes inactive user with no recent tax events", async () => {
    const user = makeUser({ id: "u1", walletAddress: "0xabc" });
    const { service, userRepo } = makeService({
      users: [user],
      taxCount: 0, // older events: 0
      taxTotal: 0, // total events: 0
    });

    const result = await service.runManually();

    expect(result.candidatesFound).toBe(1);
    expect(result.anonymized).toBe(1);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(userRepo.update).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        email: expect.stringContaining("anonymized-u1@deleted.invalid"),
        encryptedPrivateKey: null,
        passwordHash: "",
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it("does NOT anonymize user who has recent tax events", async () => {
    const user = makeUser({ id: "u2", walletAddress: "0xdef" });
    // older events: 2, total events: 5 → 3 events are after cutoff → recent events exist
    const userRepo = {
      find: jest.fn().mockResolvedValue([user]),
      update: jest.fn(),
    };
    const taxRepo = {
      count: jest
        .fn()
        .mockResolvedValueOnce(2) // events older than cutoff
        .mockResolvedValueOnce(5), // total events
    };
    const service = new DataRetentionService(
      userRepo as never,
      taxRepo as never,
    );

    const result = await service.runManually();

    expect(result.candidatesFound).toBe(1);
    expect(result.anonymized).toBe(0);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it("anonymizes multiple eligible users in one run", async () => {
    const users = [
      makeUser({ id: "u3", walletAddress: "0x111" }),
      makeUser({ id: "u4", walletAddress: "0x222" }),
    ];
    const userRepo = {
      find: jest.fn().mockResolvedValue(users),
      update: jest.fn(),
    };
    // For each user: taxCount=0, taxTotal=0 → no recent events → anonymize both
    const taxRepo = {
      count: jest.fn().mockResolvedValue(0),
    };
    const service = new DataRetentionService(
      userRepo as never,
      taxRepo as never,
    );

    const result = await service.runManually();

    expect(result.candidatesFound).toBe(2);
    expect(result.anonymized).toBe(2);
    expect(userRepo.update).toHaveBeenCalledTimes(2);
  });

  it("runRetentionJob calls runManually logic (smoke test)", async () => {
    const { service } = makeService({ users: [] });
    // Should not throw
    await expect(service.runRetentionJob()).resolves.toBeUndefined();
  });
});
