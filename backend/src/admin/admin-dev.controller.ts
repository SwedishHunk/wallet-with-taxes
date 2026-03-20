import { Body, Controller, Headers, Post, Res } from "@nestjs/common";
import { Response, CookieOptions } from "express";
import { AdminDevService } from "./admin-dev.service";

interface DevBootstrapBody {
  mode?: "player" | "studio" | "admin";
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

function cookieOpts(): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  };
}

@Controller("admin/dev")
export class AdminDevController {
  constructor(private readonly adminDevService: AdminDevService) {}

  @Post("bootstrap")
  async bootstrap(
    @Body() body: DevBootstrapBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.adminDevService.bootstrap(
      body ?? {},
      devBootstrapKey,
    );
    if (res && (result as { token?: string }).token) {
      res.cookie(
        "access_token",
        (result as { token: string }).token,
        cookieOpts(),
      );
    }
    return result;
  }
}
