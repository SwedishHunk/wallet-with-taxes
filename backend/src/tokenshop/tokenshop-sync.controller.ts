import { Controller, Post } from "@nestjs/common";
import { TokenShopListenerService } from "./tokenshop-listener.service";

@Controller("api")
export class TokenShopSyncController {
  constructor(private readonly tokenShopListenerService: TokenShopListenerService) {}

  @Post("sync")
  syncNow() {
    return this.tokenShopListenerService.syncNow();
  }
}
