import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { JwtUser } from "../auth/jwt-user.interface";
import { TaxService } from "./tax.service";
import { Response } from "express";

// 10 requests per minute per IP — tax exports can be large
@Throttle({ auth: { limit: 10, ttl: 60000 } })
@Controller("tax")
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get("summary")
  async getSummary(@Query("user") user: string, @Req() req: Request) {
    if (!user) return { error: "Missing user address in query." };
    this.assertOwnerOrAdmin(req, user);
    return this.taxService.getSummary(user.toLowerCase());
  }

  @Get("export")
  async exportCSV(
    @Query("user") user: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!user) {
      res.status(400).send("Missing user address");
      return;
    }
    this.assertOwnerOrAdmin(req, user);
    await this.taxService.exportEventsAsCSV(user.toLowerCase(), res);
  }

  /** Wallet owners can only query their own address; admins can query any. */
  private assertOwnerOrAdmin(req: Request, queriedAddress: string) {
    const jwtUser = req.user as JwtUser;
    const isAdmin = jwtUser.isAdmin === true;
    const ownsWallet =
      jwtUser.walletAddress?.toLowerCase() === queriedAddress.toLowerCase();
    if (!isAdmin && !ownsWallet) {
      throw new ForbiddenException("You can only access your own tax records");
    }
  }
}

/**
 * Player-facing tax endpoints under /api/tax/...
 * Protected by JwtAuthGuard — players must be authenticated.
 * Wallet owners can only query their own address; admins can query any.
 */
@Throttle({ auth: { limit: 10, ttl: 60000 } })
@Controller("api/tax")
@UseGuards(JwtAuthGuard)
export class ApiTaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get("summary")
  async getSummary(@Query("user") user: string, @Req() req: Request) {
    if (!user) return { error: "Missing user address in query." };
    this.assertOwnerOrAdmin(req, user);
    return this.taxService.getSummary(user.toLowerCase());
  }

  @Get("export")
  async exportCSV(
    @Query("user") user: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!user) {
      res.status(400).send("Missing user address");
      return;
    }
    this.assertOwnerOrAdmin(req, user);
    await this.taxService.exportEventsAsCSV(user.toLowerCase(), res);
  }

  /** Wallet owners can only query their own address; admins can query any. */
  private assertOwnerOrAdmin(req: Request, queriedAddress: string) {
    const jwtUser = req.user as JwtUser;
    const isAdmin = jwtUser.isAdmin === true;
    const ownsWallet =
      jwtUser.walletAddress?.toLowerCase() === queriedAddress.toLowerCase();
    if (!isAdmin && !ownsWallet) {
      throw new ForbiddenException("You can only access your own tax records");
    }
  }
}
