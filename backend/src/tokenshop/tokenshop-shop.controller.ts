import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { TokenShopQueryService } from "./tokenshop-query.service";

type SetValuationBody = { ethUsd?: number; usdSek?: number };

@Controller("api/shop")
export class TokenShopShopController {
  constructor(private readonly tokenShopQueryService: TokenShopQueryService) {}

  @Get("supported-assets")
  getSupportedAssets() {
    return this.tokenShopQueryService.getSupportedAssets();
  }

  @Get("config")
  getConfig() {
    return this.tokenShopQueryService.getShopConfig();
  }

  @Get("liquidity")
  getLiquidity() {
    return this.tokenShopQueryService.getShopLiquidity();
  }

  @Post("valuation")
  @UseGuards(JwtAuthGuard, AdminGuard)
  setValuation(@Body() body: SetValuationBody) {
    this.tokenShopQueryService.setValuation(body.ethUsd, body.usdSek);
    return { ok: true };
  }
}
