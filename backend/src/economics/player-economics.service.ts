import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Game } from "../platform/entities/game.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { PlayerWalletIdentity } from "../platform/entities/player-wallet-identity.entity";
import {
  EconomicDirection,
  EconomicScopeType,
} from "./entities/economic-event.entity";
import { EconomicsService } from "./economics.service";

type LogGameScopedEventInput = {
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

@Injectable()
export class PlayerEconomicsService {
  private readonly logger = new Logger(PlayerEconomicsService.name);

  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(PlayerWalletIdentity)
    private readonly walletIdentityRepo: Repository<PlayerWalletIdentity>,
    private readonly economicsService: EconomicsService,
  ) {}

  async resolveSession(gameId: string, walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ["studio"],
    });

    if (!game) {
      throw new NotFoundException("Game not found");
    }

    const walletIdentity =
      await this.findOrCreateWalletIdentity(normalizedWallet);
    const gamePlayer = await this.findOrCreateGamePlayer(game, walletIdentity);

    this.logger.log(
      `Resolved session studio=${game.studio.id} game=${game.id} player=${gamePlayer.id} wallet=${normalizedWallet}`,
    );

    return {
      studioId: game.studio.id,
      studioName: game.studio.name,
      gameId: game.id,
      gameName: game.name,
      gamePlayerId: gamePlayer.id,
      userId: gamePlayer.user?.id ?? null,
      walletAddress: normalizedWallet,
      scopeType: EconomicScopeType.GAME,
    };
  }

  async logGameScopedEvent(input: LogGameScopedEventInput) {
    const session = await this.resolveSession(
      input.gameId,
      input.walletAddress,
    );
    this.logger.log(
      `Persisting game-scoped event type=${input.eventType} game=${session.gameId} player=${session.gamePlayerId} tx=${input.txHash ?? "n/a"}`,
    );

    return this.economicsService.logEvent({
      source: "player_portal",
      eventType: input.eventType,
      scopeType: EconomicScopeType.GAME,
      studioId: session.studioId,
      gameId: session.gameId,
      userId: session.userId,
      gamePlayerId: session.gamePlayerId,
      walletAddress: session.walletAddress,
      assetKey: input.assetKey,
      assetSymbol: input.assetSymbol ?? null,
      amount: input.amount,
      direction: input.direction,
      txHash: input.txHash ?? null,
      metadata: {
        ...input.metadata,
        studioName: session.studioName,
        gameName: session.gameName,
      },
    });
  }

  private async findOrCreateWalletIdentity(walletAddress: string) {
    const existing = await this.walletIdentityRepo.findOne({
      where: { walletAddress },
    });
    if (existing) {
      this.logger.debug(`Reusing wallet identity for ${walletAddress}`);
      return existing;
    }

    const created = this.walletIdentityRepo.create({
      walletAddress,
    });

    this.logger.log(`Creating wallet identity for ${walletAddress}`);
    return this.walletIdentityRepo.save(created);
  }

  private async findOrCreateGamePlayer(
    game: Game,
    walletIdentity: PlayerWalletIdentity,
  ) {
    const existing = await this.gamePlayerRepo.findOne({
      where: {
        game: { id: game.id },
        walletIdentity: { id: walletIdentity.id },
      },
      relations: ["game", "user", "walletIdentity"],
    });

    if (existing) {
      this.logger.debug(
        `Reusing game player ${existing.id} for game=${game.id} walletIdentity=${walletIdentity.id}`,
      );
      return existing;
    }

    const created = this.gamePlayerRepo.create({
      game,
      walletIdentity,
      level: 1,
      exp: 0,
    });

    this.logger.log(
      `Creating game player for game=${game.id} walletIdentity=${walletIdentity.id}`,
    );
    return this.gamePlayerRepo.save(created);
  }
}
