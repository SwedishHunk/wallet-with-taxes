import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

type PlayerSessionBody = {
  gameId: string;
  walletAddress: string;
};

type LogPlayerEventBody = {
  gameId: string;
  walletAddress: string;
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
  constructor(
    private readonly economicsService: EconomicsService,
    private readonly playerEconomicsService: PlayerEconomicsService,
  ) {}

  @Get("api/player/session")
  getPlayerSession(
    @Query("gameId") gameId?: string,
    @Query("walletAddress") walletAddress?: string,
  ) {
    if (!gameId || !walletAddress) {
      throw new BadRequestException(
        "gameId and walletAddress are required",
      );
    }

    return this.playerEconomicsService.resolveSession(gameId, walletAddress);
  }

  @Post("api/player/session")
  createOrLoadPlayerSession(@Body() body?: PlayerSessionBody) {
    if (!body?.gameId || !body?.walletAddress) {
      throw new BadRequestException(
        "gameId and walletAddress are required",
      );
    }

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
      !body?.eventType ||
      !body?.assetKey ||
      !body?.amount ||
      !body?.direction
    ) {
      throw new BadRequestException(
        "gameId, walletAddress, eventType, assetKey, amount and direction are required",
      );
    }

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
  @Get("economics/game/:gameId")
  getEventsForCurrentStudioGame(
    @Req() req: Request,
    @Param("gameId") gameId: string,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.economicsService.getEventsForStudioGame(jwtUser.studioId, gameId);
  }
}
