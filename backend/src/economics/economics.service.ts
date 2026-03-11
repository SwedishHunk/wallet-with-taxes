import { BadRequestException, Injectable, Logger } from "@nestjs/common";
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
  private readonly logger = new Logger(EconomicsService.name);

  constructor(
    @InjectRepository(EconomicEvent)
    private readonly repo: Repository<EconomicEvent>,
  ) {}

  async logEvent(input: LogEconomicEventInput) {
    this.assertValidScope(input);

    const normalizedEvent = {
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
    };

    if (normalizedEvent.txHash) {
      const duplicateWhere = {
        source: normalizedEvent.source,
        eventType: normalizedEvent.eventType,
        txHash: normalizedEvent.txHash,
        assetKey: normalizedEvent.assetKey,
        direction: normalizedEvent.direction,
        amount: normalizedEvent.amount,
        ...(normalizedEvent.walletAddress
          ? { walletAddress: normalizedEvent.walletAddress }
          : {}),
        ...(normalizedEvent.gameId ? { gameId: normalizedEvent.gameId } : {}),
      };

      const existing = await this.repo.findOne({
        where: duplicateWhere,
      });

      if (existing) {
        this.logger.warn(
          `Skipping duplicate economic event tx=${normalizedEvent.txHash} type=${normalizedEvent.eventType} scope=${normalizedEvent.scopeType}`,
        );
        return existing;
      }
    }

    const event = this.repo.create(normalizedEvent);

    const saved = await this.repo.save(event);
    this.logger.log(
      `Saved economic event id=${saved.id} scope=${saved.scopeType} type=${saved.eventType} game=${saved.gameId ?? "n/a"} studio=${saved.studioId ?? "n/a"}`,
    );
    return saved;
  }

  getEventsForStudio(studioId: string, gameId?: string) {
    return this.repo.find({
      where: gameId ? { studioId, gameId } : { studioId },
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
