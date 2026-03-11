import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  Param,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Request } from "express";
import { LinkWalletDto, LoginDto, SignupDto } from "./dto/users-request.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("signup")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async signup(@Body() body: SignupDto) {
    const { email, password, studioName } = body;
    return this.usersService.signup(email, password, studioName);
  }

  @Post("login")
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    return this.usersService.login(body.email, body.password, body.studioId);
  }

  @Post("link-wallet")
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async linkWallet(@Body() body: LinkWalletDto) {
    return this.usersService.linkWallet(body.email, body.walletAddress);
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
