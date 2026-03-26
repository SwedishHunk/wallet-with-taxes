import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";

export interface KycWebhookPayload {
  sessionId: string;
  userId: string;
  status: "verified" | "rejected" | "pending";
  /**
   * DAC8 / CARF — national tax identification number (personnummer / TIN)
   * returned by the KYC provider after identity verification.
   * Stored on the user record to satisfy EU DAC8 reporting requirements.
   */
  taxIdentificationNumber?: string;
}

/**
 * KycService — wraps a KYC provider (e.g. Sumsub, Onfido, Stripe Identity).
 *
 * DEVELOPMENT (KYC_PROVIDER_KEY unset):
 *   initiateKyc() auto-approves the user immediately and returns a dev session.
 *   This lets the flow be tested end-to-end without a real provider account.
 *
 * PRODUCTION (KYC_PROVIDER_KEY set):
 *   initiateKyc() calls the external provider API and returns a real sessionId
 *   and a redirect URL for the user to complete verification in their browser.
 *   handleWebhook() processes the async callback from the provider.
 *
 * WEBHOOK SIGNATURE VERIFICATION:
 *   Set KYC_WEBHOOK_SECRET to the shared HMAC secret provided by your KYC
 *   provider. When set, every incoming webhook is verified with HMAC-SHA256
 *   before any payload is processed.  When unset (dev/test), verification
 *   is skipped.
 *
 * IMPORTANT: Before launching custodial wallets for real users, wire in a
 * real KYC provider here and gate all withdrawal flows on kycStatus="verified".
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly providerKey: string | undefined;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.providerKey = process.env.KYC_PROVIDER_KEY;

    if (this.providerKey) {
      this.logger.log("KYC provider key detected — production mode active.");
    } else {
      this.logger.warn(
        "KYC_PROVIDER_KEY is not set — running in dev auto-approve mode. " +
          "Set KYC_PROVIDER_KEY to enable real identity verification.",
      );
    }

    if (!process.env.KYC_WEBHOOK_SECRET) {
      this.logger.warn(
        "KYC_WEBHOOK_SECRET is not set — webhook signature verification " +
          "is DISABLED. Set KYC_WEBHOOK_SECRET in production.",
      );
    }
  }

  /**
   * Initiate a KYC session for the given user.
   *
   * Dev mode: immediately marks the user as "verified" and returns a stub session.
   * Prod mode: calls external KYC provider and returns a session URL.
   */
  async initiateKyc(userId: string): Promise<{
    sessionId: string;
    redirectUrl: string;
    autoApproved: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (!this.providerKey) {
      // Dev auto-approve
      await this.userRepository.update(userId, { kycStatus: "verified" });
      this.logger.debug(`KYC auto-approved for user ${userId} (dev mode)`);
      return {
        sessionId: `dev-auto-approved-${userId}`,
        redirectUrl: "/kyc/complete?status=approved",
        autoApproved: true,
      };
    }

    // Production path: call real KYC provider.
    // Replace this stub with your chosen provider's SDK/API call.
    throw new ServiceUnavailableException(
      "KYC provider integration is configured but not yet implemented. " +
        "Wire in the provider SDK in KycService.initiateKyc().",
    );
  }

  /**
   * Handle an async webhook callback from the KYC provider.
   *
   * Verifies the HMAC-SHA256 signature when KYC_WEBHOOK_SECRET is set.
   * The raw request body is required for correct signature computation —
   * never re-serialise the parsed payload as key order may differ.
   *
   * Signature format accepted: plain hex OR "sha256=<hex>" (GitHub/Stripe style).
   */
  async handleWebhook(
    payload: KycWebhookPayload,
    rawBody?: Buffer,
    signature?: string,
  ): Promise<{ updated: boolean }> {
    this.verifyWebhookSignature(rawBody, signature);

    const { userId, status, taxIdentificationNumber } = payload;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`KYC webhook for unknown user ${userId} — ignoring.`);
      return { updated: false };
    }

    // Build update payload: always update kycStatus; store TIN when provided
    // by the KYC provider (DAC8/CARF requirement for EU reporting)
    const updatePayload: Partial<User> = { kycStatus: status };
    if (taxIdentificationNumber) {
      updatePayload.taxIdentificationNumber = taxIdentificationNumber;
    }

    await this.userRepository.update(userId, updatePayload);
    this.logger.log(
      `KYC status updated: user=${userId} status=${status}` +
        (taxIdentificationNumber ? " (TIN stored)" : ""),
    );
    return { updated: true };
  }

  // ── private helpers ────────────────────────────────────────────────────────

  /**
   * Verifies the HMAC-SHA256 webhook signature.
   *
   * When KYC_WEBHOOK_SECRET is not configured (dev/test), verification is
   * skipped entirely. In production the secret must be set.
   *
   * Uses timingSafeEqual to prevent timing-based signature oracle attacks.
   */
  private verifyWebhookSignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
    const secret = process.env.KYC_WEBHOOK_SECRET;
    if (!secret) return; // dev mode — skip verification

    if (!signature || !rawBody) {
      throw new UnauthorizedException(
        "KYC webhook: x-kyc-signature header is required in production",
      );
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    // Accept both plain hex and "sha256=<hex>" (Stripe/GitHub style)
    const rawSig = signature.replace(/^sha256=/, "");
    const sigBuf = Buffer.from(rawSig, "hex");
    const expBuf = Buffer.from(expected, "hex");

    // timingSafeEqual throws if lengths differ — guard with length check first
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException("KYC webhook: invalid signature");
    }
  }
}
