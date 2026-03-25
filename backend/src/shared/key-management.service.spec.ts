import { KeyManagementService } from "./key-management.service";

const VALID_KEY = "12345678901234567890123456789012"; // 32 bytes for AES-256

describe("KeyManagementService (AES path)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    delete process.env.KMS_KEY_ARN;
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => new KeyManagementService()).toThrow(
      "ENCRYPTION_KEY environment variable is required",
    );
  });

  it("constructs without error when ENCRYPTION_KEY is set", () => {
    expect(() => new KeyManagementService()).not.toThrow();
  });

  it("encrypt returns a non-empty ciphertext different from the plaintext", async () => {
    const svc = new KeyManagementService();
    const plaintext = "0xdeadbeef_private_key";
    const cipher = await svc.encrypt(plaintext);
    expect(typeof cipher).toBe("string");
    expect(cipher.length).toBeGreaterThan(0);
    expect(cipher).not.toBe(plaintext);
  });

  it("decrypt round-trips encrypt output back to plaintext", async () => {
    const svc = new KeyManagementService();
    const plaintext = "0xdeadbeef_private_key";
    const cipher = await svc.encrypt(plaintext);
    const recovered = await svc.decrypt(cipher);
    expect(recovered).toBe(plaintext);
  });

  it("different encryptions of same plaintext produce different ciphertexts (unique IVs)", async () => {
    const svc = new KeyManagementService();
    const plaintext = "0xdeadbeef_private_key";
    const c1 = await svc.encrypt(plaintext);
    const c2 = await svc.encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it("decrypt handles legacy v1: prefix format", async () => {
    // The crypto.util produces "v1:<base64>" format for GCM
    const svc = new KeyManagementService();
    const plaintext = "legacy_key_value";
    const cipher = await svc.encrypt(plaintext);
    // Verify it's a v1: format (not kms:) when KMS_KEY_ARN is unset
    expect(cipher.startsWith("v1:")).toBe(true);
    expect(await svc.decrypt(cipher)).toBe(plaintext);
  });
});

describe("KeyManagementService (KMS path — key not present, fallback error)", () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  it("throws a helpful error when KMS_KEY_ARN is set but SDK is not installed", async () => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    process.env.KMS_KEY_ARN = "arn:aws:kms:eu-north-1:123456789012:key/test";
    const svc = new KeyManagementService();

    // @aws-sdk/client-kms is not installed in the test environment,
    // so getKmsClient() should throw with a helpful message.
    await expect(svc.encrypt("some-key")).rejects.toThrow(
      "@aws-sdk/client-kms is not installed",
    );
  });
});
