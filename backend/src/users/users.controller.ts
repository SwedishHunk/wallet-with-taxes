import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  Param,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Request } from "express";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("signup")
  async signup(
    @Body() body: { email: string; password: string; studioName?: string },
  ) {
    const { email, password, studioName } = body;
    return this.usersService.signup(email, password, studioName);
  }

  @Post("login")
  async login(
    @Body() body: { email: string; password: string; studioId?: string },
  ) {
    return this.usersService.login(body.email, body.password, body.studioId);
  }

  @Post("link-wallet")
  async linkWallet(@Body() body: { email: string; walletAddress: string }) {
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
