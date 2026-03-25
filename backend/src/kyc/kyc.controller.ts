import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  RawBody,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { KycService, KycWebhookPayload } from "./kyc.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * POST /kyc/initiate
   * Authenticated user requests a KYC session.
   * Returns sessionId + redirectUrl for the identity verification flow.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post("initiate")
  async initiate(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.kycService.initiateKyc(user.id);
  }

  /**
   * POST /kyc/webhook
   * Async callback from the KYC provider with the verification result.
   *
   * The raw request body is passed to the service for HMAC-SHA256 signature
   * verification. Set KYC_WEBHOOK_SECRET to the shared secret from your
   * provider to enable verification. Without the secret, verification is
   * skipped (dev/test mode).
   *
   * Expected header: x-kyc-signature: sha256=<hex_digest>
   */
  @Post("webhook")
  async webhook(
    @Headers("x-kyc-signature") signature: string | undefined,
    @RawBody() rawBody: Buffer,
    @Body() payload: KycWebhookPayload,
  ) {
    return this.kycService.handleWebhook(payload, rawBody, signature);
  }
}
