import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Response, CookieOptions, Request } from "express";
import { AdminDevService } from "./admin-dev.service";
import { JwtUser } from "../auth/jwt-user.interface";

interface DevBootstrapBody {
  mode?: "player" | "studio" | "admin";
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

interface DevSeedMembersBody {
  studioId: string;
  count?: number;
}

interface DevClearSeedMembersBody {
  studioId: string;
}

interface DevSeedGamesBody {
  studioId: string;
  count?: number;
}

interface DevClearSeedGamesBody {
  studioId: string;
}

interface DevSwitchSessionBody {
  studioId: string;
  memberId?: string;
}

interface DevRestoreSessionBody {
  returnToken?: string;
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

  @Get("session-targets")
  async getSessionTargets(
    @Req() req: Request,
    @Headers("x-admin-return-token") returnToken?: string,
  ) {
    return this.adminDevService.getSessionTargets(
      req.user as JwtUser | undefined,
      returnToken,
      req.cookies?.access_token,
    );
  }

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

  @Post("seed-members")
  async seedMembers(
    @Body() body: DevSeedMembersBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
  ) {
    return this.adminDevService.seedMembers(body, devBootstrapKey);
  }

  @Post("clear-seed-members")
  async clearSeedMembers(
    @Body() body: DevClearSeedMembersBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
  ) {
    return this.adminDevService.clearSeedMembers(body, devBootstrapKey);
  }

  @Post("seed-games")
  async seedGames(
    @Body() body: DevSeedGamesBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
  ) {
    return this.adminDevService.seedGames(body, devBootstrapKey);
  }

  @Post("clear-seed-games")
  async clearSeedGames(
    @Body() body: DevClearSeedGamesBody,
    @Headers("x-dev-bootstrap-key") devBootstrapKey?: string,
  ) {
    return this.adminDevService.clearSeedGames(body, devBootstrapKey);
  }

  @Post("switch-session")
  async switchSession(
    @Body() body: DevSwitchSessionBody,
    @Req() req: Request,
    @Headers("x-admin-return-token") returnToken?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.adminDevService.switchSession(
      body,
      req.user as JwtUser | undefined,
      returnToken,
      req.cookies?.access_token,
    );

    if (res && result.token) {
      res.cookie("access_token", result.token, cookieOpts());
    }

    return result;
  }

  @Post("restore-session")
  async restoreSession(
    @Body() body: DevRestoreSessionBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.adminDevService.restoreSession(
      body.returnToken,
      req.user as JwtUser | undefined,
      req.cookies?.access_token,
    );

    if (res && result.token) {
      res.cookie("access_token", result.token, cookieOpts());
    }

    return result;
  }
}
