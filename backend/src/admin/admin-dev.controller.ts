import { Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AdminDevService } from "./admin-dev.service";

interface DevBootstrapBody {
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

@Controller("admin/dev")
export class AdminDevController {
  constructor(private readonly adminDevService: AdminDevService) {}

  @Post("bootstrap")
  async bootstrap(
    @Req() req: Request,
    @Body() body: DevBootstrapBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
  ) {
    return this.adminDevService.bootstrap(body ?? {}, devBootstrapKey, {
      ip: req.ip,
      remoteAddress: req.socket.remoteAddress,
    });
  }
}
