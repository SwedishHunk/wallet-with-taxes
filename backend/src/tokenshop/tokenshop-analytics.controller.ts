import { Controller, Get, Query } from "@nestjs/common";
import { TokenShopAnalyticsService } from "./tokenshop-analytics.service";

@Controller("api/analytics")
export class TokenShopAnalyticsController {
  constructor(private readonly tokenShopAnalyticsService: TokenShopAnalyticsService) {}

  @Get("summary")
  getSummary() {
    return this.tokenShopAnalyticsService.getSummary();
  }

  @Get("per-asset")
  getPerAsset() {
    return this.tokenShopAnalyticsService.getPerAsset();
  }

  @Get("activity")
  getActivity(@Query("limit") limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 15, 1), 100);
    return this.tokenShopAnalyticsService.getRecentActivity(parsedLimit);
  }
}
