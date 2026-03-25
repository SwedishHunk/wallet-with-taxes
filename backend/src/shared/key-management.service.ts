import { Injectable, Logger } from "@nestjs/common";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto.util";

/**
 * KeyManagementService — abstraction layer over private key encryption.
 *
 * CURRENT IMPLEMENTATION: env-var backed AES-256-GCM (same as before).
 * PRODUCTION PATH: swap the implementation here for AWS KMS, HashiCorp Vault,
 * or Google Cloud KMS without touching any call-site in users.service.ts or
 * studios.service.ts.
 *
 * How to migrate to real KMS:
 *   1. Add a KMS client here (e.g. @aws-sdk/client-kms).
 *   2. In encrypt(): call kms.encrypt() and return the base64 ciphertext.
 *   3. In decrypt(): call kms.decrypt() and return the plaintext.
 *   4. Set KMS_KEY_ARN (or equivalent) in env and check for it here.
 *   5. Existing v1: ciphertexts are still decrypted with the env-var path
 *      (backward compat) until all keys are re-encrypted with the KMS key.
 *
 * IMPORTANT: The plaintext private key must NEVER be logged or stored
 * anywhere. It should only exist in memory for the duration of a signing
 * operation and then be garbage-collected.
 */
@Injectable()
export class KeyManagementService {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly encryptionKey: string;
  private readonly legacyIv: string | undefined;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    this.encryptionKey = key;
    this.legacyIv = process.env.ENCRYPTION_IV;

    // Log which backend is active (never log the key itself)
    const kmsKeyArn = process.env.KMS_KEY_ARN;
    if (kmsKeyArn) {
      this.logger.warn(
        "KMS_KEY_ARN is set but real KMS integration is not yet implemented. " +
        "Falling back to env-var AES-256-GCM. Implement KMS encrypt/decrypt here.",
      );
    } else {
      this.logger.warn(
        "Using env-var AES-256-GCM for private key encryption. " +
        "For production, migrate to AWS KMS / HashiCorp Vault and set KMS_KEY_ARN.",
      );
    }
  }

  /**
   * Encrypts a private key (plaintext) and returns the ciphertext string.
   * The ciphertext is safe to store in the database.
   */
  encrypt(plaintextPrivateKey: string): string {
    return encryptPrivateKey(plaintextPrivateKey, this.encryptionKey);
  }

  /**
   * Decrypts a stored ciphertext and returns the plaintext private key.
   * Handles both the current v1: GCM format and the legacy CBC format.
   *
   * @throws if the ciphertext is malformed or the key is wrong.
   */
  decrypt(encryptedPrivateKey: string): string {
    return decryptPrivateKey(encryptedPrivateKey, this.encryptionKey, this.legacyIv);
  }
}
