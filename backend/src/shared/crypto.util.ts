import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV — NIST recommended for GCM

/**
 * Encrypt plaintext using AES-256-GCM with a fresh random IV per call.
 * Output format: "v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * AES-256-GCM provides both confidentiality (via counter-mode encryption)
 * and integrity (via the 128-bit authentication tag). A static IV with GCM
 * would be catastrophic (key-stream reuse), so we always generate a new one.
 */
export function encryptPrivateKey(
  plaintext: string,
  encryptionKey: string,
): string {
  const key = Buffer.from(encryptionKey, "utf8");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertextBuf = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertextBuf.toString("hex")}`;
}

/**
 * Decrypt a key produced by encryptPrivateKey().
 * Handles legacy AES-256-CBC ciphertexts (no "v1:" prefix) so that
 * wallets created before this migration can still be decrypted.
 *
 * @param encrypted  The stored ciphertext string.
 * @param encryptionKey  32-byte UTF-8 encryption key from env.
 * @param legacyIv  Required only for CBC legacy ciphertexts (ENCRYPTION_IV env var).
 */
export function decryptPrivateKey(
  encrypted: string,
  encryptionKey: string,
  legacyIv?: string,
): string {
  const key = Buffer.from(encryptionKey, "utf8");

  if (encrypted.startsWith("v1:")) {
    // AES-256-GCM — new format
    const parts = encrypted.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted key format");
    }
    const [, ivHex, tagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return (
      decipher.update(ciphertext).toString("utf8") + decipher.final("utf8")
    );
  }

  // Legacy AES-256-CBC — backward compat for pre-migration wallets
  if (!legacyIv) {
    throw new Error(
      "Legacy encrypted key requires ENCRYPTION_IV for decryption",
    );
  }
  const iv = Buffer.from(legacyIv, "utf8");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
}
