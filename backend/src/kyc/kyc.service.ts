import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";

export interface KycWebhookPayload {
  sessionId: string;
  userId: string;
  status: "verified" | "rejected" | "pending";
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
   * Updates the user's kycStatus based on the provider's decision.
   *
   * In production, this endpoint must verify the webhook signature
   * (provider-specific HMAC or public-key signature) before processing.
   */
  async handleWebhook(
    payload: KycWebhookPayload,
  ): Promise<{ updated: boolean }> {
    const { userId, status } = payload;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`KYC webhook for unknown user ${userId} — ignoring.`);
      return { updated: false };
    }

    await this.userRepository.update(userId, { kycStatus: status });
    this.logger.log(`KYC status updated: user=${userId} status=${status}`);
    return { updated: true };
  }
}
