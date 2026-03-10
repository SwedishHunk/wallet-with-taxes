import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  EconomicDirection,
  EconomicEvent,
  EconomicScopeType,
} from "./entities/economic-event.entity";

export type LogEconomicEventInput = {
  source: string;
  eventType: string;
  scopeType: EconomicScopeType;
  studioId?: string | null;
  gameId?: string | null;
  userId?: string | null;
  gamePlayerId?: string | null;
  walletAddress?: string | null;
  assetKey: string;
  assetSymbol?: string | null;
  amount: string;
  direction: EconomicDirection;
  txHash?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: Date;
};

@Injectable()
export class EconomicsService {
  constructor(
    @InjectRepository(EconomicEvent)
    private readonly repo: Repository<EconomicEvent>,
  ) {}

  async logEvent(input: LogEconomicEventInput) {
    this.assertValidScope(input);

    const event = this.repo.create({
      ...input,
      walletAddress: input.walletAddress?.toLowerCase() ?? null,
      assetKey: input.assetKey.trim(),
      assetSymbol: input.assetSymbol?.trim() ?? null,
      studioId: input.studioId ?? null,
      gameId: input.gameId ?? null,
      userId: input.userId ?? null,
      gamePlayerId: input.gamePlayerId ?? null,
      txHash: input.txHash?.toLowerCase() ?? null,
      metadata: input.metadata ?? null,
      timestamp: input.timestamp ?? new Date(),
    });

    return this.repo.save(event);
  }

  getEventsForStudio(studioId: string) {
    return this.repo.find({
      where: { studioId },
      order: { timestamp: "DESC", createdAt: "DESC" },
    });
  }

  getEventsForStudioGame(studioId: string, gameId: string) {
    return this.repo.find({
      where: { studioId, gameId },
      order: { timestamp: "DESC", createdAt: "DESC" },
    });
  }

  getEventsForGame(gameId: string) {
    return this.repo.find({
      where: { gameId },
      order: { timestamp: "DESC", createdAt: "DESC" },
    });
  }

  getEventsForWallet(walletAddress: string) {
    return this.repo.find({
      where: { walletAddress: walletAddress.toLowerCase() },
      order: { timestamp: "DESC", createdAt: "DESC" },
    });
  }

  private assertValidScope(input: LogEconomicEventInput) {
    if (!input.source?.trim()) {
      throw new BadRequestException("source is required");
    }

    if (!input.eventType?.trim()) {
      throw new BadRequestException("eventType is required");
    }

    if (!input.assetKey?.trim()) {
      throw new BadRequestException("assetKey is required");
    }

    if (input.scopeType === EconomicScopeType.GLOBAL) {
      if (input.studioId || input.gameId) {
        throw new BadRequestException(
          "global events cannot include studioId or gameId",
        );
      }
      return;
    }

    if (input.scopeType === EconomicScopeType.STUDIO) {
      if (!input.studioId) {
        throw new BadRequestException("studio events require studioId");
      }
      if (input.gameId) {
        throw new BadRequestException("studio events cannot include gameId");
      }
      return;
    }

    if (input.scopeType === EconomicScopeType.GAME) {
      if (!input.studioId || !input.gameId) {
        throw new BadRequestException(
          "game events require both studioId and gameId",
        );
      }
    }
  }
}
