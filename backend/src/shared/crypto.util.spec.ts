import { decryptPrivateKey, encryptPrivateKey } from "./crypto.util";

const KEY_32 = "12345678901234567890123456789012"; // 32 UTF-8 bytes
const LEGACY_IV = "1234567890123456"; // 16 bytes for AES-CBC

describe("crypto.util", () => {
  it("round-trips a private key with GCM", () => {
    const plaintext = "0x" + "a".repeat(64);
    const encrypted = encryptPrivateKey(plaintext, KEY_32);
    expect(encrypted).toMatch(/^v1:/);
    expect(decryptPrivateKey(encrypted, KEY_32)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "0x" + "b".repeat(64);
    const enc1 = encryptPrivateKey(plaintext, KEY_32);
    const enc2 = encryptPrivateKey(plaintext, KEY_32);
    expect(enc1).not.toBe(enc2);
  });

  it("decrypts legacy AES-CBC ciphertext with legacyIv", () => {
    // Produce a CBC ciphertext manually to test backward compat
    const crypto = require("crypto") as typeof import("crypto");
    const key = Buffer.from(KEY_32, "utf8");
    const iv = Buffer.from(LEGACY_IV, "utf8");
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const plaintext = "0x" + "c".repeat(64);
    const cbcCipher =
      cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");

    // cbcCipher has no "v1:" prefix — must be handled by legacy path
    expect(decryptPrivateKey(cbcCipher, KEY_32, LEGACY_IV)).toBe(plaintext);
  });

  it("throws when legacy format is decrypted without IV", () => {
    const fakeOldCipher = "deadbeef"; // no v1: prefix, no legacyIv provided
    expect(() => decryptPrivateKey(fakeOldCipher, KEY_32)).toThrow(
      "Legacy encrypted key requires ENCRYPTION_IV",
    );
  });

  it("throws on malformed v1 ciphertext", () => {
    expect(() => decryptPrivateKey("v1:only:two", KEY_32)).toThrow(
      "Invalid encrypted key format",
    );
  });
});
