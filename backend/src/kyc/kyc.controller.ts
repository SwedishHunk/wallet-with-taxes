import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
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
   * In production, this endpoint MUST verify the provider's webhook signature
   * before processing. Currently accepts any payload (dev/stub mode).
   */
  @Post("webhook")
  async webhook(@Body() payload: KycWebhookPayload) {
    return this.kycService.handleWebhook(payload);
  }
}
