import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { ethers } from "ethers";
import { TokenShopAnalyticsService } from "./tokenshop-analytics.service";
import { TokenShopQueryService } from "./tokenshop-query.service";

@Controller("api/user")
export class TokenShopUserController {
  constructor(
    private readonly tokenShopQueryService: TokenShopQueryService,
    private readonly tokenShopAnalyticsService: TokenShopAnalyticsService,
  ) {}

  @Get(":userAddress/balance")
  getBalance(@Param("userAddress") userAddress: string) {
    if (!ethers.isAddress(userAddress)) {
      throw new BadRequestException("Invalid user address");
    }

    return this.tokenShopQueryService.getUserBalance(userAddress);
  }

  @Get(":userAddress/history")
  getHistory(@Param("userAddress") userAddress: string) {
    if (!ethers.isAddress(userAddress)) {
      throw new BadRequestException("Invalid user address");
    }

    return this.tokenShopAnalyticsService.getUserHistory(userAddress);
  }
}
