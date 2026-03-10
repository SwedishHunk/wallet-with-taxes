import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { Game } from "../platform/entities/game.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { User } from "../users/user.entity";
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
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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

    const user = await this.findOrCreateWalletUser(normalizedWallet);
    const gamePlayer = await this.findOrCreateGamePlayer(game, user);

    return {
      studioId: game.studio.id,
      studioName: game.studio.name,
      gameId: game.id,
      gameName: game.name,
      gamePlayerId: gamePlayer.id,
      userId: user.id,
      walletAddress: normalizedWallet,
      scopeType: EconomicScopeType.GAME,
    };
  }

  async logGameScopedEvent(input: LogGameScopedEventInput) {
    const session = await this.resolveSession(input.gameId, input.walletAddress);

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

  private async findOrCreateWalletUser(walletAddress: string) {
    const existing = await this.userRepo.findOne({ where: { walletAddress } });
    if (existing) {
      return existing;
    }

    const syntheticEmail = `wallet-${walletAddress.slice(2)}@player.local`;
    const created: User = this.userRepo.create({
      email: syntheticEmail,
      passwordHash: randomUUID(),
      custodyMode: "self",
      encryptedPrivateKey: null,
      walletAddress,
      kycStatus: "pending",
      onChainWallet: undefined,
      isAdmin: false,
    });

    return this.userRepo.save(created);
  }

  private async findOrCreateGamePlayer(game: Game, user: User) {
    const existing = await this.gamePlayerRepo.findOne({
      where: { game: { id: game.id }, user: { id: user.id } },
      relations: ["game", "user"],
    });

    if (existing) {
      return existing;
    }

    const created = this.gamePlayerRepo.create({
      game,
      user,
      level: 1,
      exp: 0,
    });

    return this.gamePlayerRepo.save(created);
  }
}
