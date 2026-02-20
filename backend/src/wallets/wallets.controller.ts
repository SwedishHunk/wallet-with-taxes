import { Controller, Post, Body, Get, Query, Param } from "@nestjs/common";
import { WalletsService } from "./wallets.service";
import { RegisterWalletDto } from "./dto/wallets-request.dto";

@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post("register")
  async register(@Body() body: RegisterWalletDto) {
    const { owner, address } = body;
    return this.walletsService.registerWallet(owner, address);
  }
  @Get("balance")
  getBalance(@Query("address") address: string) {
    return this.walletsService.getBalance(address);
  }

  @Get("assets")
  getAssets(@Query("address") address: string) {
    return this.walletsService.getAssets(address);
  }

  @Get("assets/:id")
  getAssetDetail(@Param("id") id: string, @Query("address") address: string) {
    return this.walletsService.getAssetDetail(address, id);
  }
}
