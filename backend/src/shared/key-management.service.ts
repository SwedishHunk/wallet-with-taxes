import { Injectable, Logger } from "@nestjs/common";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto.util";

/**
 * KeyManagementService — abstraction layer over private key encryption.
 *
 * BACKEND SELECTION (evaluated at startup):
 *   KMS_KEY_ARN set  → AWS KMS (requires @aws-sdk/client-kms installed)
 *   KMS_KEY_ARN unset → env-var backed AES-256-GCM (dev/PoC default)
 *
 * MIGRATION PATH (v1 → KMS):
 *   Existing "v1:" AES ciphertexts are still decryptable via the AES path
 *   so keys can be re-encrypted lazily without a big-bang migration.
 *
 * IMPORTANT: The plaintext private key must NEVER be logged or stored
 * anywhere outside this service. It should only exist in memory for the
 * duration of a signing operation and then be garbage-collected.
 */
@Injectable()
export class KeyManagementService {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly encryptionKey: string;
  private readonly legacyIv: string | undefined;
  private readonly kmsKeyArn: string | undefined;

  private kmsClient: any = null;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    this.encryptionKey = key;
    this.legacyIv = process.env.ENCRYPTION_IV;
    this.kmsKeyArn = process.env.KMS_KEY_ARN;

    if (this.kmsKeyArn) {
      this.logger.log(
        `KMS backend active (KeyId: ${this.kmsKeyArn.slice(-12)}). ` +
          "Requires @aws-sdk/client-kms installed at runtime.",
      );
    } else {
      this.logger.warn(
        "Using env-var AES-256-GCM for private key encryption. " +
          "For production, set KMS_KEY_ARN to enable AWS KMS backend.",
      );
    }
  }

  /**
   * Encrypts a private key (plaintext) and returns the ciphertext string.
   * The ciphertext is safe to store in the database.
   *
   * When KMS_KEY_ARN is set the ciphertext is prefixed with "kms:" so that
   * decryptAsync can route to the correct backend.
   */
  async encrypt(plaintextPrivateKey: string): Promise<string> {
    if (this.kmsKeyArn) {
      return this.kmsEncrypt(plaintextPrivateKey);
    }
    return encryptPrivateKey(plaintextPrivateKey, this.encryptionKey);
  }

  /**
   * Decrypts a stored ciphertext and returns the plaintext private key.
   *
   * Routing:
   *   "kms:<base64>" → AWS KMS DecryptCommand
   *   "v1:<base64>"  → AES-256-GCM (current AES format)
   *   "<hex>"        → legacy AES-256-CBC (backward compat)
   */
  async decrypt(encryptedPrivateKey: string): Promise<string> {
    if (encryptedPrivateKey.startsWith("kms:")) {
      return this.kmsDecrypt(encryptedPrivateKey);
    }
    return decryptPrivateKey(
      encryptedPrivateKey,
      this.encryptionKey,
      this.legacyIv,
    );
  }

  // ── AWS KMS helpers ───────────────────────────────────────────────────────

  private async kmsEncrypt(plaintext: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client = await this.getKmsClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { EncryptCommand } = require("@aws-sdk/client-kms");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await client.send(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      new EncryptCommand({
        KeyId: this.kmsKeyArn,
        Plaintext: Buffer.from(plaintext, "utf8"),
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const cipherBlob = result.CiphertextBlob as Uint8Array;
    return "kms:" + Buffer.from(cipherBlob).toString("base64");
  }

  private async kmsDecrypt(encryptedPrivateKey: string): Promise<string> {
    const cipherB64 = encryptedPrivateKey.slice(4); // strip "kms:" prefix
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client = await this.getKmsClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { DecryptCommand } = require("@aws-sdk/client-kms");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await client.send(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      new DecryptCommand({
        KeyId: this.kmsKeyArn,
        CiphertextBlob: Buffer.from(cipherB64, "base64"),
      }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Buffer.from(result.Plaintext as Uint8Array).toString("utf8");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getKmsClient(): Promise<any> {
    if (this.kmsClient) return this.kmsClient;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const { KMSClient } = require("@aws-sdk/client-kms");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      this.kmsClient = new KMSClient({
        region: process.env.AWS_REGION ?? "eu-north-1",
      });
    } catch (err) {
      throw new Error(
        "KMS_KEY_ARN is set but @aws-sdk/client-kms is not installed. " +
          "Run: npm install @aws-sdk/client-kms\n" +
          String(err instanceof Error ? err.message : err),
      );
    }

    return this.kmsClient;
  }
}
