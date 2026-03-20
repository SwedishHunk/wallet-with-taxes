import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  Param,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response, CookieOptions } from "express";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { JwtUser } from "../auth/jwt-user.interface";
import {
  LinkWalletDto,
  LoginDto,
  SelectStudioDto,
  SignupDto,
} from "./dto/users-request.dto";

const ACCESS_COOKIE = "access_token";

function cookieOpts(): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    // SameSite=strict works on localhost across ports (same eTLD+1),
    // so no Vite proxy is needed for development.
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 1 day (matches JWT expiry)
  };
}

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("signup")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async signup(
    @Body() body: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password, studioName } = body;
    const result = await this.usersService.signup(email, password, studioName);
    res.cookie(ACCESS_COOKIE, result.token, cookieOpts());
    const { token: _token, ...payload } = result;
    return payload;
  }

  @Post("login")
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.login(
      body.email,
      body.password,
      body.studioId,
    );
    res.cookie(ACCESS_COOKIE, result.token, cookieOpts());
    const { token: _token, ...payload } = result;
    return payload;
  }

  /**
   * Exchange the base JWT (post-login) for a studio-scoped JWT by explicitly
   * selecting a studio. Required for multi-studio users before accessing any
   * studio-specific resources.
   */
  @Post("select-studio")
  @UseGuards(JwtAuthGuard)
  async selectStudio(
    @Body() body: SelectStudioDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const jwtUser = req.user as JwtUser;
    const result = await this.usersService.selectStudio(jwtUser, body.studioId);
    res.cookie(ACCESS_COOKIE, result.token, cookieOpts());
    const { token: _token, ...payload } = result;
    return payload;
  }

  /** Clear the HttpOnly auth cookie and end the session. */
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: "/", httpOnly: true });
    return { success: true };
  }

  @Post("link-wallet")
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async linkWallet(@Body() body: LinkWalletDto) {
    return this.usersService.linkWallet(
      body.email,
      body.walletAddress,
      body.signature,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Req() req: Request) {
    const jwtUser = req.user as { id: string };
    const fullUser = await this.usersService.findById(jwtUser.id);
    return fullUser;
  }

  @UseGuards(JwtAuthGuard)
  @Get("studios")
  async getStudios(@Req() req: Request) {
    const jwtUser = req.user as { id: string };
    return this.usersService.getStudiosForUser(jwtUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("member-session/:studioId")
  async getMemberSession(
    @Req() req: Request,
    @Param("studioId") studioId: string,
  ) {
    const jwtUser = req.user as { id: string };
    return this.usersService.getMemberSession(jwtUser.id, studioId);
  }
}
