import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { EconomicsService } from "../economics/economics.service";
import {
  EconomicDirection,
  EconomicScopeType,
} from "../economics/entities/economic-event.entity";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { User } from "../users/user.entity";
import { GameWalletAdminService } from "./game-wallet-admin.service";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { PlayerWalletIdentity } from "./entities/player-wallet-identity.entity";

@Injectable()
export class NFTInventoryService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(NFTTemplate)
    private readonly nftTemplateRepo: Repository<NFTTemplate>,
    @InjectRepository(NFTInstance)
    private readonly nftInstanceRepo: Repository<NFTInstance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PlayerWalletIdentity)
    private readonly walletIdentityRepo: Repository<PlayerWalletIdentity>,
    private readonly economicsService: EconomicsService,
    private readonly gameWalletAdminService: GameWalletAdminService,
  ) {}

  private async assertGameBelongsToStudio(gameId: string, studioId: string) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ["studio"],
    });
    if (!game) {
      throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    }
    if (game.studio?.id !== studioId) {
      throw new AppException(ERROR_MESSAGES.ACCESS_DENIED, 403);
    }
    return game;
  }

  async getNFTTemplatesForGame(gameId: string, studioId: string) {
    await this.assertGameBelongsToStudio(gameId, studioId);
    return this.nftTemplateRepo.find({
      where: { game: { id: gameId } },
      relations: ["game"],
    });
  }

  async getPlayerNFTs(gameId: string, userId: string, studioId: string) {
    await this.assertGameBelongsToStudio(gameId, studioId);
    const { gamePlayer } = await this.gameWalletAdminService.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );

    return this.nftInstanceRepo.find({
      where: { owner: { id: gamePlayer.id } },
      relations: ["template", "owner"],
    });
  }

  async createNFTTemplate(
    gameId: string,
    studioId: string,
    data: {
      name: string;
      tier?: number;
      attributes?: Record<string, any>;
      upkeepCostPerDay?: string;
      mintingCost?: string;
      maxMintCount?: number;
    },
  ) {
    const game = await this.assertGameBelongsToStudio(gameId, studioId);

    const template = this.nftTemplateRepo.create({
      game,
      name: data.name,
      tier: data.tier || 1,
      attributes: data.attributes || {},
      upkeepCostPerDay: data.upkeepCostPerDay || "0",
      mintingCost: data.mintingCost || "0",
      maxMintCount: data.maxMintCount,
      currentMintCount: 0,
    });

    return this.nftTemplateRepo.save(template);
  }

  async mintNFTToPlayer(
    gameId: string,
    studioId: string,
    templateId: string,
    targetGamePlayerId?: string,
  ) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new Error("Game not found or access denied");
    }

    const template = await this.nftTemplateRepo.findOne({
      where: { id: templateId, game: { id: gameId } },
      relations: ["game"],
    });
    if (!template) {
      throw new Error("NFT template not found");
    }

    if (
      template.maxMintCount &&
      template.currentMintCount >= template.maxMintCount
    ) {
      throw new Error("Max mint count reached for this template");
    }

    const gamePlayer = await this.gamePlayerRepo.findOne({
      where: targetGamePlayerId
        ? { id: targetGamePlayerId, game: { id: gameId } }
        : { game: { id: gameId } },
    });

    if (!gamePlayer) {
      throw new Error("No game player found for minting");
    }

    const nftInstance = this.nftInstanceRepo.create({
      template,
      owner: gamePlayer,
      name: `${template.name} #${template.currentMintCount + 1}`,
      level: 1,
      condition: 100,
      power: 0,
      customAttributes: {},
      equipped: false,
    });

    await this.nftInstanceRepo.save(nftInstance);

    template.currentMintCount += 1;
    await this.nftTemplateRepo.save(template);

    void this.economicsService
      .logEvent({
        source: "platform-nft-mint",
        eventType: "nft_mint",
        scopeType: EconomicScopeType.GAME,
        studioId,
        gameId,
        gamePlayerId: gamePlayer.id,
        assetKey: `nft:${template.id}`,
        assetSymbol: "NFT",
        amount: "1",
        direction: EconomicDirection.IN,
        metadata: {
          templateId: template.id,
          templateName: template.name,
          tier: template.tier,
          instanceId: nftInstance.id,
          instanceName: nftInstance.name,
        },
      })
      .catch((err) =>
        console.error("[PlatformService] Failed to log NFT mint event:", err),
      );

    return nftInstance;
  }

  async getAllNFTsForWallet(walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    const walletIdentity = await this.walletIdentityRepo.findOne({
      where: { walletAddress: normalizedWallet },
    });
    if (walletIdentity) {
      return this.nftInstanceRepo.find({
        where: { owner: { walletIdentity: { id: walletIdentity.id } } },
        relations: ["template", "template.game", "owner", "owner.game"],
        order: { createdAt: "DESC" },
      });
    }

    const user = await this.userRepo.findOne({
      where: { walletAddress: normalizedWallet },
    });
    if (!user) {
      return [];
    }

    return this.nftInstanceRepo.find({
      where: { owner: { user: { id: user.id } } },
      relations: ["template", "template.game", "owner", "owner.game"],
      order: { createdAt: "DESC" },
    });
  }

  async getAllNFTInstancesForGame(gameId: string, studioId: string) {
    await this.assertGameBelongsToStudio(gameId, studioId);
    return this.nftInstanceRepo.find({
      where: { template: { game: { id: gameId } } },
      relations: ["template", "owner", "owner.user", "owner.studioUser"],
      order: { createdAt: "DESC" },
    });
  }

  async updateNFTInstance(
    gameId: string,
    userId: string,
    studioId: string,
    nftId: string,
    updates: {
      equipped?: boolean;
      condition?: number;
      customAttributes?: Record<string, any>;
    },
  ) {
    const { gamePlayer } = await this.gameWalletAdminService.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );

    const nftInstance = await this.nftInstanceRepo.findOne({
      where: {
        id: nftId,
        owner: { id: gamePlayer.id },
        template: { game: { id: gameId } },
      },
      relations: ["template", "owner"],
    });

    if (!nftInstance) {
      throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);
    }

    if (updates.equipped !== undefined) {
      nftInstance.equipped = updates.equipped;
    }
    if (updates.condition !== undefined) {
      nftInstance.condition = Math.max(0, Math.min(100, updates.condition));
    }
    if (updates.customAttributes) {
      nftInstance.customAttributes = {
        ...nftInstance.customAttributes,
        ...updates.customAttributes,
      };
    }

    return this.nftInstanceRepo.save(nftInstance);
  }
}
