import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ethers } from "ethers";
import { TokenShopQueryService } from "./tokenshop-query.service";

@Controller("api/quotes")
export class TokenShopQuotesController {
  constructor(private readonly tokenShopQueryService: TokenShopQueryService) {}

  @Get("buy-eth")
  getBuyEthQuote(@Query("amount") amount?: string) {
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException(
        "Invalid amount — provide a positive ETH value",
      );
    }

    return this.tokenShopQueryService.quoteBuyEth(amount);
  }

  @Get("sell-eth")
  getSellEthQuote(@Query("gen") gen?: string) {
    if (!gen || Number.isNaN(Number(gen)) || Number(gen) <= 0) {
      throw new BadRequestException(
        "Invalid gen — provide a positive TRI value",
      );
    }

    return this.tokenShopQueryService.quoteSellEth(gen);
  }

  @Get("buy-token")
  getBuyTokenQuote(
    @Query("asset") asset?: string,
    @Query("amount") amount?: string,
  ) {
    if (!asset || !ethers.isAddress(asset)) {
      throw new BadRequestException("Invalid asset address");
    }
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException("Invalid amount");
    }

    return this.tokenShopQueryService.quoteBuyToken(asset, amount);
  }

  @Get("sell-token")
  getSellTokenQuote(
    @Query("asset") asset?: string,
    @Query("gen") gen?: string,
  ) {
    if (!asset || !ethers.isAddress(asset)) {
      throw new BadRequestException("Invalid asset address");
    }
    if (!gen || Number.isNaN(Number(gen)) || Number(gen) <= 0) {
      throw new BadRequestException("Invalid gen amount");
    }

    return this.tokenShopQueryService.quoteSellToken(asset, gen);
  }
}
