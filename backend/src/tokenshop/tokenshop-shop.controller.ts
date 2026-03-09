import { Controller, Get } from "@nestjs/common";
import { TokenShopQueryService } from "./tokenshop-query.service";

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
}
