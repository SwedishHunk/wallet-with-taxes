import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { JwtUser } from "../auth/jwt-user.interface";
import { TaxService } from "./tax.service";
import { Response } from "express";

function parseYear(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return isFinite(n) && n >= 2020 && n <= 2099 ? n : undefined;
}

// 10 requests per minute per IP — tax exports can be large
@Throttle({ auth: { limit: 10, ttl: 60000 } })
@Controller("tax")
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get("summary")
  async getSummary(
    @Query("user") user: string,
    @Query("year") yearRaw: string | undefined,
    @Req() req: Request,
  ) {
    if (!user) return { error: "Missing user address in query." };
    this.assertOwnerOrAdmin(req, user);
    return this.taxService.getSummary(user.toLowerCase(), parseYear(yearRaw));
  }

  @Get("export")
  async exportCSV(
    @Query("user") user: string,
    @Query("year") yearRaw: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
    @Query("force") force?: string,
  ) {
    if (!user) {
      res.status(400).send("Missing user address");
      return;
    }
    this.assertOwnerOrAdmin(req, user);

    const jwtUser = req.user as JwtUser;
    const isAdmin = jwtUser.isAdmin === true;

    // Missing-valuation gate: block export when >5% of events lack price data,
    // unless the requester is an admin overriding with ?force=true.
    if (!(isAdmin && force === "true")) {
      const readiness = await this.taxService.checkExportReadiness(
        user.toLowerCase(),
        parseYear(yearRaw),
      );
      if (readiness.blocked) {
        throw new UnprocessableEntityException({
          message:
            "Export blocked: too many events are missing price data. " +
            "Tax report would be materially incomplete for filing purposes.",
          missingCount: readiness.missingCount,
          totalCount: readiness.totalCount,
          missingRatioPct: +(readiness.missingRatio * 100).toFixed(1),
          thresholdPct: 5,
          hint: "Admins can bypass this gate by adding ?force=true to the request.",
        });
      }
    }

    await this.taxService.exportEventsAsCSV(
      user.toLowerCase(),
      res,
      parseYear(yearRaw),
    );
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
  async getSummary(
    @Query("user") user: string,
    @Query("year") yearRaw: string | undefined,
    @Req() req: Request,
  ) {
    if (!user) return { error: "Missing user address in query." };
    this.assertOwnerOrAdmin(req, user);
    return this.taxService.getSummary(user.toLowerCase(), parseYear(yearRaw));
  }

  @Get("export")
  async exportCSV(
    @Query("user") user: string,
    @Query("year") yearRaw: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
    @Query("force") force?: string,
  ) {
    if (!user) {
      res.status(400).send("Missing user address");
      return;
    }
    this.assertOwnerOrAdmin(req, user);

    const jwtUser = req.user as JwtUser;
    const isAdmin = jwtUser.isAdmin === true;

    // Missing-valuation gate: block export when >5% of events lack price data,
    // unless the requester is an admin overriding with ?force=true.
    if (!(isAdmin && force === "true")) {
      const readiness = await this.taxService.checkExportReadiness(
        user.toLowerCase(),
        parseYear(yearRaw),
      );
      if (readiness.blocked) {
        throw new UnprocessableEntityException({
          message:
            "Export blocked: too many events are missing price data. " +
            "Tax report would be materially incomplete for filing purposes.",
          missingCount: readiness.missingCount,
          totalCount: readiness.totalCount,
          missingRatioPct: +(readiness.missingRatio * 100).toFixed(1),
          thresholdPct: 5,
          hint: "Admins can bypass this gate by adding ?force=true to the request.",
        });
      }
    }

    await this.taxService.exportEventsAsCSV(
      user.toLowerCase(),
      res,
      parseYear(yearRaw),
    );
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
