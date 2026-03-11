import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { JwtUser } from "../auth/jwt-user.interface";
import { EconomicsService } from "./economics.service";
import { PlayerEconomicsService } from "./player-economics.service";
import { EconomicDirection } from "./entities/economic-event.entity";
import {
  PlayerWalletAuthPurpose,
  PlayerWalletAuthService,
} from "./player-wallet-auth.service";

type PlayerSessionBody = {
  gameId: string;
  walletAddress: string;
  nonce: string;
  signature: string;
};

type LogPlayerEventBody = {
  gameId: string;
  walletAddress: string;
  nonce: string;
  signature: string;
  txHash?: string;
  eventType: string;
  assetKey: string;
  assetSymbol?: string;
  amount: string;
  direction: EconomicDirection;
  metadata?: Record<string, unknown>;
};

@Controller()
export class EconomicsController {
  private readonly logger = new Logger(EconomicsController.name);

  constructor(
    private readonly economicsService: EconomicsService,
    private readonly playerEconomicsService: PlayerEconomicsService,
    private readonly playerWalletAuthService: PlayerWalletAuthService,
  ) {}

  @Get("api/player/nonce")
  getPlayerNonce(
    @Query("walletAddress") walletAddress?: string,
    @Query("purpose") purpose?: PlayerWalletAuthPurpose,
    @Query("gameId") gameId?: string,
  ) {
    if (!walletAddress || !purpose) {
      throw new BadRequestException("walletAddress and purpose are required");
    }

    if (purpose !== "session" && purpose !== "economic_event") {
      throw new BadRequestException(
        "purpose must be either session or economic_event",
      );
    }

    return this.playerWalletAuthService.issueNonce(walletAddress, purpose, gameId);
  }

  @Post("api/player/session")
  createOrLoadPlayerSession(@Body() body?: PlayerSessionBody) {
    if (!body?.gameId || !body?.walletAddress || !body?.nonce || !body?.signature) {
      throw new BadRequestException(
        "gameId, walletAddress, nonce and signature are required",
      );
    }

    this.playerWalletAuthService.verifySignedRequest({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      signature: body.signature,
      purpose: "session",
      gameId: body.gameId,
    });

    return this.playerEconomicsService.resolveSession(
      body.gameId,
      body.walletAddress,
    );
  }

  @Post("api/player/game-economic-event")
  logGameScopedPlayerEvent(@Body() body?: LogPlayerEventBody) {
    if (
      !body?.gameId ||
      !body?.walletAddress ||
      !body?.nonce ||
      !body?.signature ||
      !body?.eventType ||
      !body?.assetKey ||
      !body?.amount ||
      !body?.direction
    ) {
      throw new BadRequestException(
        "gameId, walletAddress, nonce, signature, eventType, assetKey, amount and direction are required",
      );
    }

    this.playerWalletAuthService.verifySignedRequest({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      signature: body.signature,
      purpose: "economic_event",
      gameId: body.gameId,
    });

    this.logger.log(
      `Logging game economic event type=${body.eventType} game=${body.gameId} wallet=${body.walletAddress.toLowerCase()} amount=${body.amount}`,
    );
    return this.playerEconomicsService.logGameScopedEvent({
      gameId: body.gameId,
      walletAddress: body.walletAddress,
      txHash: body.txHash,
      eventType: body.eventType,
      assetKey: body.assetKey,
      assetSymbol: body.assetSymbol,
      amount: body.amount,
      direction: body.direction,
      metadata: body.metadata,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("economics/studio")
  getEventsForCurrentStudio(
    @Req() req: Request,
    @Query("gameId") gameId?: string,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.economicsService.getEventsForStudio(
      jwtUser.studioId,
      gameId?.trim() || undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("economics/game/:gameId")
  getEventsForCurrentStudioGame(
    @Req() req: Request,
    @Param("gameId") gameId: string,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.economicsService.getEventsForStudioGame(
      jwtUser.studioId,
      gameId,
    );
  }
}
