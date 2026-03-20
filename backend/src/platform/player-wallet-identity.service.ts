import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { PlayerWalletIdentity } from "./entities/player-wallet-identity.entity";

@Injectable()
export class PlayerWalletIdentityService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(GameWallet)
    private readonly walletRepo: Repository<GameWallet>,
    @InjectRepository(PlayerWalletIdentity)
    private readonly walletIdentityRepo: Repository<PlayerWalletIdentity>,
  ) {}

  private async getGameOrThrow(gameId: string): Promise<Game> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) {
      throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    }
    return game;
  }

  private async assertGameBelongsToStudio(
    gameId: string,
    studioId: string,
  ): Promise<void> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ["studio"],
    });
    if (!game) {
      throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    }
    if (game.studio.id !== studioId) {
      throw new AppException(ERROR_MESSAGES.ACCESS_DENIED, 403);
    }
  }

  private async ensureGamePlayerForWalletIdentity(
    game: Game,
    walletIdentity: PlayerWalletIdentity,
  ) {
    let player = await this.gamePlayerRepo.findOne({
      where: {
        walletIdentity: { id: walletIdentity.id },
        game: { id: game.id },
      },
      relations: ["game", "walletIdentity"],
    });
    if (!player) {
      player = this.gamePlayerRepo.create({ walletIdentity, game });
      player = await this.gamePlayerRepo.save(player);
    }
    return player;
  }

  private async ensureWalletForGamePlayer(gamePlayer: GamePlayer) {
    let wallet = await this.walletRepo.findOne({
      where: { gamePlayer: { id: gamePlayer.id } },
    });
    if (!wallet) {
      wallet = this.walletRepo.create({
        gamePlayer,
        balance: "0",
        totalDeposited: "0",
        totalWithdrawn: "0",
      });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  async resolvePlayerGameWallet(gameId: string, walletAddress: string) {
    const game = await this.getGameOrThrow(gameId);
    const normalizedWallet = walletAddress.toLowerCase();

    let walletIdentity = await this.walletIdentityRepo.findOne({
      where: { walletAddress: normalizedWallet },
    });
    if (!walletIdentity) {
      walletIdentity = this.walletIdentityRepo.create({
        walletAddress: normalizedWallet,
      });
      walletIdentity = await this.walletIdentityRepo.save(walletIdentity);
    }

    const gamePlayer = await this.ensureGamePlayerForWalletIdentity(
      game,
      walletIdentity,
    );
    const wallet = await this.ensureWalletForGamePlayer(gamePlayer);

    return { walletIdentity, gamePlayer, wallet };
  }

  async registerPlayerByWallet(
    gameId: string,
    walletAddress: string,
    studioId: string,
  ) {
    await this.assertGameBelongsToStudio(gameId, studioId);
    return this.resolvePlayerGameWallet(gameId, walletAddress);
  }

  async getPlayerGameWallet(gameId: string, walletAddress: string) {
    await this.getGameOrThrow(gameId);

    const walletIdentity = await this.walletIdentityRepo.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    if (!walletIdentity) {
      return null;
    }

    const gamePlayer = await this.gamePlayerRepo.findOne({
      where: {
        game: { id: gameId },
        walletIdentity: { id: walletIdentity.id },
      },
    });
    if (!gamePlayer) {
      return null;
    }

    return (
      (await this.walletRepo.findOne({
        where: { gamePlayer: { id: gamePlayer.id } },
      })) ?? null
    );
  }
}
