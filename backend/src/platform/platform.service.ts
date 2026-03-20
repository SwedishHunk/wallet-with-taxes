import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { createHash, randomUUID } from "crypto";
import { ethers } from "ethers";
import { Studio } from "./entities/studio.entity";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { WalletDepositIntent } from "./entities/wallet-deposit-intent.entity";
import { MarketplaceListing } from "./entities/marketplace-listing.entity";
import { PlayerWalletIdentity } from "./entities/player-wallet-identity.entity";
import { User } from "../users/user.entity";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { EconomicsService } from "../economics/economics.service";
import {
  EconomicDirection,
  EconomicScopeType,
} from "../economics/entities/economic-event.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";
import { MarketplaceService } from "./marketplace.service";
import { PlayerWalletOperationsService } from "./player-wallet-operations.service";
import { NFTShopService } from "./nft-shop.service";
import { GameWalletAdminService } from "./game-wallet-admin.service";

@Injectable()
export class PlatformService {
  private static readonly DEPOSIT_INTENT_TTL_MS = 15 * 60 * 1000;
  private readonly rpcUrl = process.env.RPC_URL?.trim();
  private readonly rpcProvider = this.rpcUrl
    ? new ethers.JsonRpcProvider(this.rpcUrl)
    : null;

  private buildStudioScopedSlug(baseSlug: string, studioId: string): string {
    return `${baseSlug}-${studioId.slice(0, 8)}`;
  }

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Studio)
    private studioRepo: Repository<Studio>,
    @InjectRepository(StudioMember)
    private studioMemberRepo: Repository<StudioMember>,
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(GameWallet)
    private walletRepo: Repository<GameWallet>,
    @InjectRepository(LedgerEntry)
    private ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(NFTTemplate)
    private nftTemplateRepo: Repository<NFTTemplate>,
    @InjectRepository(NFTInstance)
    private nftInstanceRepo: Repository<NFTInstance>,
    @InjectRepository(WalletDepositIntent)
    private walletDepositIntentRepo: Repository<WalletDepositIntent>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PlayerWalletIdentity)
    private walletIdentityRepo: Repository<PlayerWalletIdentity>,
    @InjectRepository(MarketplaceListing)
    private marketplaceListingRepo: Repository<MarketplaceListing>,
    private economicsService: EconomicsService,
    private playerWalletIdentityService: PlayerWalletIdentityService,
    private marketplaceService: MarketplaceService,
    private playerWalletOperationsService: PlayerWalletOperationsService,
    private nftShopService: NFTShopService,
    private gameWalletAdminService: GameWalletAdminService,
  ) {}

  private generateFakeDepositAddress(
    gameId: string,
    userId: string,
    intentId: string,
  ): string {
    const hash = createHash("sha256")
      .update(`${gameId}:${userId}:${intentId}`)
      .digest("hex");
    return `0x${hash.slice(0, 40)}`;
  }

  private isValidTxHash(txHash: string): boolean {
    const value = txHash.trim();
    return value.length >= 10 && value.startsWith("0x");
  }

  private async verifyNativeDepositTransaction(
    intent: WalletDepositIntent,
    txHash: string,
  ) {
    if (!this.rpcProvider) {
      throw new AppException(
        "External deposit confirmation is unavailable: RPC is not configured",
        503,
      );
    }

    const [tx, receipt] = await Promise.all([
      this.rpcProvider.getTransaction(txHash),
      this.rpcProvider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt) {
      throw new AppException("Deposit transaction not found on chain", 400);
    }

    if (receipt.status !== 1) {
      throw new AppException("Deposit transaction did not succeed", 400);
    }

    if (!tx.to || tx.to.toLowerCase() !== intent.depositAddress.toLowerCase()) {
      throw new AppException(
        "Deposit transaction recipient does not match intent",
        400,
      );
    }

    const expectedValue = ethers.parseUnits(intent.amount, 18);
    if (tx.value !== expectedValue) {
      throw new AppException(
        "Deposit transaction amount does not match intent",
        400,
      );
    }
  }

  private async findUserOrThrow(
    userRepo: Repository<User>,
    userId: string,
  ): Promise<User> {
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }

  private async ensureGamePlayer(
    gamePlayerRepo: Repository<GamePlayer>,
    game: Game,
    user: User,
  ): Promise<GamePlayer> {
    let player = await gamePlayerRepo.findOne({
      where: { user: { id: user.id }, game: { id: game.id } },
      relations: ["game", "user"],
    });
    if (!player) {
      player = gamePlayerRepo.create({ user, game });
      player = await gamePlayerRepo.save(player);
    }
    return player;
  }

  private async ensureGamePlayerForWalletIdentity(
    gamePlayerRepo: Repository<GamePlayer>,
    game: Game,
    walletIdentity: PlayerWalletIdentity,
  ): Promise<GamePlayer> {
    let player = await gamePlayerRepo.findOne({
      where: {
        walletIdentity: { id: walletIdentity.id },
        game: { id: game.id },
      },
      relations: ["game", "walletIdentity"],
    });
    if (!player) {
      player = gamePlayerRepo.create({ walletIdentity, game });
      player = await gamePlayerRepo.save(player);
    }
    return player;
  }

  private async ensureWalletForGamePlayer(
    walletRepo: Repository<GameWallet>,
    gamePlayer: GamePlayer,
  ): Promise<GameWallet> {
    let wallet = await walletRepo.findOne({
      where: { gamePlayer: { id: gamePlayer.id } },
    });
    if (!wallet) {
      wallet = walletRepo.create({
        gamePlayer,
        balance: "0",
        totalDeposited: "0",
        totalWithdrawn: "0",
      });
      wallet = await walletRepo.save(wallet);
    }
    return wallet;
  }

  private async resolvePlayerGameWallet(gameId: string, walletAddress: string) {
    return this.playerWalletIdentityService.resolvePlayerGameWallet(
      gameId,
      walletAddress,
    );
  }

  private async lockWalletOrThrow(
    walletRepo: Repository<GameWallet>,
    walletId: string,
    notFoundMessage: string,
  ): Promise<GameWallet> {
    const locked = await walletRepo.findOne({
      where: { id: walletId },
      lock: { mode: "pessimistic_write" },
    });
    if (!locked) {
      throw new AppException(notFoundMessage, 404);
    }
    return locked;
  }

  private normalizeIdempotencyKey(idempotencyKey?: string | null) {
    const normalized = idempotencyKey?.trim();
    if (!normalized) {
      return null;
    }
    if (normalized.length > 128) {
      throw new AppException(
        "idempotencyKey must be 128 characters or less",
        400,
      );
    }
    return normalized;
  }

  private async getWalletByIdOrThrow(
    walletId: string,
    notFoundMessage: string,
  ) {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new AppException(notFoundMessage, 404);
    }
    return wallet;
  }

  private async getReplayWallets(fromWalletId: string, toWalletId: string) {
    const [fromWallet, toWallet] = await Promise.all([
      this.getWalletByIdOrThrow(fromWalletId, "Sender wallet not found"),
      this.getWalletByIdOrThrow(toWalletId, "Recipient wallet not found"),
    ]);
    return { fromWallet, toWallet };
  }

  /**
   * Asserts that a game belongs to the given studio.
   * Throws 404 if game not found, 403 if studio mismatch.
   */
  private async assertGameBelongsToStudio(
    gameId: string,
    studioId: string,
  ): Promise<Game> {
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

    return game;
  }

  async ensureStudioForUser(userId: string) {
    const studio = await this.studioRepo.findOne({
      where: { members: { user: { id: userId } } },
      relations: ["members"],
    });
    if (studio) return studio;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const created = this.studioRepo.create({
      name: user.email,
      email: user.email,
      walletAddress: user.walletAddress,
    });
    const savedStudio = await this.studioRepo.save(created);

    // Create owner membership
    const membership = this.studioMemberRepo.create({
      studio: savedStudio,
      user,
      role: StudioRole.OWNER,
    });
    await this.studioMemberRepo.save(membership);

    return savedStudio;
  }

  async getStudiosForUser(userId: string) {
    return this.studioRepo
      .createQueryBuilder("studio")
      .leftJoinAndSelect("studio.members", "members")
      .where("members.user_id = :userId", { userId })
      .getMany();
  }

  async getStudioWithRoleForUser(studioId: string, userId: string) {
    const member = await this.studioMemberRepo.findOne({
      where: { studio: { id: studioId }, user: { id: userId } },
      relations: ["studio"],
    });
    if (!member) throw new AppException(ERROR_MESSAGES.ACCESS_DENIED, 403);
    return { studio: member.studio, role: member.role };
  }

  async createGameForUser(
    userId: string,
    studioId: string,
    data: { name: string; slug: string },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new AppException(ERROR_MESSAGES.STUDIO_NOT_FOUND, 404);

    const existingStudioGame = await this.gameRepo.findOne({
      where: { studio: { id: studioId }, slug: data.slug },
    });
    if (existingStudioGame) {
      throw new AppException(
        "A game with this slug already exists in this studio.",
        409,
      );
    }

    let slugToSave = data.slug;
    const globalSlugConflict = await this.gameRepo.findOne({
      where: { slug: slugToSave },
      relations: ["studio"],
    });

    if (globalSlugConflict && globalSlugConflict.studio?.id !== studioId) {
      slugToSave = this.buildStudioScopedSlug(data.slug, studioId);

      while (
        await this.gameRepo.findOne({
          where: { slug: slugToSave },
        })
      ) {
        slugToSave = `${this.buildStudioScopedSlug(data.slug, studioId)}-${randomUUID().slice(0, 4)}`;
      }
    }

    const game = this.gameRepo.create({ ...data, slug: slugToSave, studio });
    return this.gameRepo.save(game);
  }

  async getGamesForUser(studioId: string) {
    return this.gameRepo.find({ where: { studio: { id: studioId } } });
  }

  async getPublicGameList() {
    return this.gameRepo.find({
      select: ["id", "name", "slug"],
      order: { name: "ASC" },
    });
  }

  async getGameById(gameId: string, userId: string, studioId: string) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
      relations: ["studio"],
    });
    if (!game) throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    return game;
  }

  async ensureGameWalletForPlayer(
    gameId: string,
    userId: string,
    studioId: string,
  ) {
    return this.gameWalletAdminService.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );
  }

  async getGameWalletBalance(gameId: string, userId: string, studioId: string) {
    return this.gameWalletAdminService.getGameWalletBalance(
      gameId,
      userId,
      studioId,
    );
  }

  async getGameWalletLedger(gameId: string, userId: string, studioId: string) {
    return this.gameWalletAdminService.getGameWalletLedger(
      gameId,
      userId,
      studioId,
    );
  }

  async depositToGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
    description?: string,
    idempotencyKey?: string,
  ) {
    return this.gameWalletAdminService.depositToGameWallet(
      gameId,
      userId,
      studioId,
      amount,
      description,
      idempotencyKey,
    );
  }

  async createWalletDepositIntent(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
  ) {
    return this.gameWalletAdminService.createWalletDepositIntent(
      gameId,
      userId,
      studioId,
      amount,
    );
  }

  async confirmWalletDepositIntent(
    gameId: string,
    userId: string,
    studioId: string,
    intentId: string,
    txHash: string,
    idempotencyKey?: string,
  ) {
    return this.gameWalletAdminService.confirmWalletDepositIntent(
      gameId,
      userId,
      studioId,
      intentId,
      txHash,
      idempotencyKey,
    );
  }

  async withdrawFromGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
    description?: string,
    idempotencyKey?: string,
  ) {
    return this.gameWalletAdminService.withdrawFromGameWallet(
      gameId,
      userId,
      studioId,
      amount,
      description,
      idempotencyKey,
    );
  }

  async transferBetweenPlayersInGame(
    gameId: string,
    fromUserId: string,
    toUserId: string,
    studioId: string,
    amount: unknown,
    description?: string,
    idempotencyKey?: string,
  ) {
    return this.gameWalletAdminService.transferBetweenPlayersInGame(
      gameId,
      fromUserId,
      toUserId,
      studioId,
      amount,
      description,
      idempotencyKey,
    );
  }

  // NFT Methods

  async getNFTTemplatesForGame(gameId: string, studioId: string) {
    // Verify game belongs to studio
    await this.assertGameBelongsToStudio(gameId, studioId);

    return this.nftTemplateRepo.find({
      where: { game: { id: gameId } },
      relations: ["game"],
    });
  }

  async getPlayerNFTs(gameId: string, userId: string, studioId: string) {
    // Verify game belongs to studio
    await this.assertGameBelongsToStudio(gameId, studioId);

    const { gamePlayer } = await this.ensureGameWalletForPlayer(
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
    // Verify game belongs to studio
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
    // Verify game belongs to studio
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) throw new Error("Game not found or access denied");

    // Get template
    const template = await this.nftTemplateRepo.findOne({
      where: { id: templateId, game: { id: gameId } },
      relations: ["game"],
    });
    if (!template) throw new Error("NFT template not found");

    // Check mint limit
    if (
      template.maxMintCount &&
      template.currentMintCount >= template.maxMintCount
    ) {
      throw new Error("Max mint count reached for this template");
    }

    // Resolve target player — specific player if provided, otherwise first in game
    const gamePlayer = await this.gamePlayerRepo.findOne({
      where: targetGamePlayerId
        ? { id: targetGamePlayerId, game: { id: gameId } }
        : { game: { id: gameId } },
    });

    if (!gamePlayer) {
      throw new Error("No game player found for minting");
    }

    // Create NFT instance
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

    // Update mint count
    template.currentMintCount += 1;
    await this.nftTemplateRepo.save(template);

    // Log as economic event (fire-and-forget — don't fail the mint if logging fails)
    void this.economicsService
      .logEvent({
        source: "platform-nft-mint",
        eventType: "nft_mint",
        scopeType: EconomicScopeType.GAME,
        studioId: studioId,
        gameId: gameId,
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

  // ─── Player-facing wallet operations (wallet address based) ───────────────

  async registerPlayerByWallet(
    gameId: string,
    walletAddress: string,
    studioId: string,
  ) {
    return this.playerWalletIdentityService.registerPlayerByWallet(
      gameId,
      walletAddress,
      studioId,
    );
  }

  async getPlayerGameWallet(gameId: string, walletAddress: string) {
    return this.playerWalletIdentityService.getPlayerGameWallet(
      gameId,
      walletAddress,
    );
  }

  async playerWithdrawFromGameWallet(
    gameId: string,
    walletAddress: string,
    amount: unknown,
    idempotencyKey?: string,
  ) {
    return this.playerWalletOperationsService.playerWithdrawFromGameWallet(
      gameId,
      walletAddress,
      amount,
      idempotencyKey,
    );
  }

  async playerTransferBetweenPlayers(
    gameId: string,
    fromWalletAddress: string,
    toWalletAddress: string,
    amount: unknown,
    idempotencyKey?: string,
  ) {
    return this.playerWalletOperationsService.playerTransferBetweenPlayers(
      gameId,
      fromWalletAddress,
      toWalletAddress,
      amount,
      idempotencyKey,
    );
  }

  async playerTransferNFT(
    gameId: string,
    fromWalletAddress: string,
    toWalletAddress: string,
    nftInstanceId: string,
  ) {
    return this.playerWalletOperationsService.playerTransferNFT(
      gameId,
      fromWalletAddress,
      toWalletAddress,
      nftInstanceId,
    );
  }

  // ─── Marketplace ───────────────────────────────────────────────────────────

  async getGameListings(gameId: string) {
    return this.marketplaceService.getGameListings(gameId);
  }

  async createNFTListing(
    gameId: string,
    walletAddress: string,
    nftInstanceId: string,
    askPrice: string,
  ) {
    return this.marketplaceService.createNFTListing(
      gameId,
      walletAddress,
      nftInstanceId,
      askPrice,
    );
  }

  async cancelNFTListing(
    gameId: string,
    walletAddress: string,
    listingId: string,
  ) {
    return this.marketplaceService.cancelNFTListing(
      gameId,
      walletAddress,
      listingId,
    );
  }

  async purchaseNFTListing(
    gameId: string,
    walletAddress: string,
    listingId: string,
  ) {
    return this.marketplaceService.purchaseNFTListing(
      gameId,
      walletAddress,
      listingId,
    );
  }

  // ─── NFT Shop (player-facing) ───────────────────────────────────────────────

  async getNFTShopTemplates(gameId: string) {
    return this.nftShopService.getNFTShopTemplates(gameId);
  }

  async purchaseNFTFromShop(
    gameId: string,
    walletAddress: string,
    templateId: string,
    idempotencyKey?: string,
  ) {
    return this.nftShopService.purchaseNFTFromShop(
      gameId,
      walletAddress,
      templateId,
      idempotencyKey,
    );
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
    if (!user) return [];

    return this.nftInstanceRepo.find({
      where: { owner: { user: { id: user.id } } },
      relations: ["template", "template.game", "owner", "owner.game"],
      order: { createdAt: "DESC" },
    });
  }

  async getGamePlayers(gameId: string, studioId: string) {
    return this.gameWalletAdminService.getGamePlayers(gameId, studioId);
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
    const { gamePlayer } = await this.ensureGameWalletForPlayer(
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

    if (!nftInstance)
      throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);

    if (updates.equipped !== undefined) nftInstance.equipped = updates.equipped;
    if (updates.condition !== undefined)
      nftInstance.condition = Math.max(0, Math.min(100, updates.condition));
    if (updates.customAttributes)
      nftInstance.customAttributes = {
        ...nftInstance.customAttributes,
        ...updates.customAttributes,
      };

    return this.nftInstanceRepo.save(nftInstance);
  }

  // TODO: restore personal-account/studio-user flows

  createPersonalAccount(
    studioId: string,
    email: string,
    password: string,
    accessPoints?: Record<string, boolean>,
  ): never {
    // Parameters preserved for API signature compatibility - referenced to satisfy linter
    const _ = { studioId, email, password, accessPoints };
    throw new AppException(_ ? "Not implemented" : "Not implemented", 501);
  }

  getStudioUsers(studioId: string): never {
    // Parameter preserved for API signature compatibility - referenced to satisfy linter
    const _ = { studioId };
    throw new AppException(_ ? "Not implemented" : "Not implemented", 501);
  }

  loginStudioUser(studioId: string, email: string, password: string): never {
    // Parameters preserved for API signature compatibility - referenced to satisfy linter
    const _ = { studioId, email, password };
    throw new AppException(_ ? "Not implemented" : "Not implemented", 501);
  }

  updatePersonalAccountPermissions(
    studioId: string,
    userId: string,
    accessPoints: Record<string, boolean>,
  ): never {
    // Parameters preserved for API signature compatibility - referenced to satisfy linter
    const _ = { studioId, userId, accessPoints };
    throw new AppException(_ ? "Not implemented" : "Not implemented", 501);
  }
}
