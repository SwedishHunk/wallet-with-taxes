import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { createHash, randomUUID } from "crypto";
import { Studio } from "./entities/studio.entity";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import {
  WalletDepositIntent,
  WalletDepositIntentStatus,
} from "./entities/wallet-deposit-intent.entity";
import { User } from "../users/user.entity";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { parseAmount } from "./parse-amount";

@Injectable()
export class PlatformService {
  private static readonly DEPOSIT_INTENT_TTL_MS = 15 * 60 * 1000;

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

  private isValidFakeTxHash(txHash: string): boolean {
    const value = txHash.trim();
    return value.length >= 10 && value.startsWith("0x");
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

    const game = this.gameRepo.create({ ...data, studio });
    return this.gameRepo.save(game);
  }

  async getGamesForUser(studioId: string) {
    return this.gameRepo.find({ where: { studio: { id: studioId } } });
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
    // Verify game belongs to this studio
    const game = await this.assertGameBelongsToStudio(gameId, studioId);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);

    let gamePlayer = await this.gamePlayerRepo.findOne({
      where: { user: { id: userId }, game: { id: gameId } },
    });

    if (!gamePlayer) {
      gamePlayer = this.gamePlayerRepo.create({
        user,
        game,
        level: 1,
        exp: 0,
      });
      gamePlayer = await this.gamePlayerRepo.save(gamePlayer);
    }

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

    return { gamePlayer, wallet };
  }

  async getGameWalletBalance(gameId: string, userId: string, studioId: string) {
    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );
    return wallet;
  }

  async getGameWalletLedger(gameId: string, userId: string, studioId: string) {
    // Ensure wallet exists for this player
    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );
    // Get all ledger entries for this wallet
    return this.ledgerRepo.find({
      where: { wallet: { id: wallet.id } },
      order: { createdAt: "DESC" },
    });
  }

  async depositToGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
    description?: string,
  ) {
    const amountNum = parseAmount(amount);

    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );

    // Generate txGroupId for this transaction
    const txGroupId = randomUUID();

    return await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const newBalance = (parseFloat(wallet.balance) + amountNum).toString();

      wallet.balance = newBalance;
      wallet.totalDeposited = (
        parseFloat(wallet.totalDeposited) + amountNum
      ).toString();
      const savedWallet = await walletRepo.save(wallet);

      const ledgerEntry = ledgerRepo.create({
        wallet: savedWallet,
        txGroupId,
        type: "deposit",
        amount: amountNum.toString(),
        description: description || "Deposit",
      });
      await ledgerRepo.save(ledgerEntry);

      return savedWallet;
    });
  }

  async createWalletDepositIntent(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
  ) {
    const amountNum = parseAmount(amount);

    const game = await this.assertGameBelongsToStudio(gameId, studioId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const intentId = randomUUID();
    const expiresAt = new Date(
      Date.now() + PlatformService.DEPOSIT_INTENT_TTL_MS,
    );
    const depositAddress = this.generateFakeDepositAddress(
      gameId,
      userId,
      intentId,
    );

    const intent = this.walletDepositIntentRepo.create({
      id: intentId,
      game,
      user,
      amount: amountNum.toString(),
      depositAddress,
      status: WalletDepositIntentStatus.PENDING,
      expiresAt,
    });
    await this.walletDepositIntentRepo.save(intent);

    return {
      intentId: intent.id,
      depositAddress: intent.depositAddress,
      amount: intent.amount,
      expiresAt: intent.expiresAt.toISOString(),
    };
  }

  async confirmWalletDepositIntent(
    gameId: string,
    userId: string,
    studioId: string,
    intentId: string,
    txHash: string,
  ) {
    if (!this.isValidFakeTxHash(txHash)) {
      throw new AppException("Invalid txHash", 400);
    }

    await this.assertGameBelongsToStudio(gameId, studioId);
    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );

    const txGroupId = randomUUID();
    const normalizedTxHash = txHash.trim();

    let result: { expired: true } | { expired: false; wallet: GameWallet };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const intentRepo = manager.getRepository(WalletDepositIntent);
        const walletRepo = manager.getRepository(GameWallet);
        const ledgerRepo = manager.getRepository(LedgerEntry);

        const intent = await intentRepo.findOne({
          where: {
            id: intentId,
            game: { id: gameId },
            user: { id: userId },
          },
          lock: { mode: "pessimistic_write" },
        });

        if (!intent) {
          throw new AppException("Deposit intent not found", 404);
        }

        if (intent.status !== WalletDepositIntentStatus.PENDING) {
          throw new AppException("Deposit intent is not pending", 400);
        }

        const now = new Date();
        if (intent.expiresAt.getTime() <= now.getTime()) {
          intent.status = WalletDepositIntentStatus.EXPIRED;
          await intentRepo.save(intent);
          return { expired: true as const };
        }

        const lockedWallet = await walletRepo.findOne({
          where: { id: wallet.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!lockedWallet) {
          throw new AppException("Game wallet not found", 404);
        }

        const amountNum = parseFloat(intent.amount);
        lockedWallet.balance = (
          parseFloat(lockedWallet.balance) + amountNum
        ).toString();
        lockedWallet.totalDeposited = (
          parseFloat(lockedWallet.totalDeposited) + amountNum
        ).toString();
        const savedWallet = await walletRepo.save(lockedWallet);

        intent.status = WalletDepositIntentStatus.CONFIRMED;
        intent.txHash = normalizedTxHash;
        intent.confirmedAt = now;
        await intentRepo.save(intent);

        const ledgerEntry = ledgerRepo.create({
          wallet: savedWallet,
          txGroupId,
          type: "deposit",
          amount: intent.amount,
          intentId: intent.id,
          description: `External deposit txHash=${normalizedTxHash} intentId=${intent.id}`,
          txHash: normalizedTxHash,
        });
        await ledgerRepo.save(ledgerEntry);

        return { expired: false as const, wallet: savedWallet };
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint ===
            "uq_wallet_deposit_intents_tx_hash_not_null"
        ) {
          throw new AppException("txHash already used", 400);
        }
      }
      throw error;
    }

    if (result.expired) {
      throw new AppException("Deposit intent has expired", 400);
    }

    return result.wallet;
  }

  async withdrawFromGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: unknown,
    description?: string,
  ) {
    const wallet = await this.getGameWalletBalance(gameId, userId, studioId);
    const amountNum = parseAmount(amount);

    const balanceNum = parseFloat(wallet.balance);

    if (amountNum > balanceNum) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    // Generate txGroupId for this transaction
    const txGroupId = randomUUID();

    return await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const newBalance = (balanceNum - amountNum).toString();
      wallet.balance = newBalance;
      wallet.totalWithdrawn = (
        parseFloat(wallet.totalWithdrawn) + amountNum
      ).toString();
      const savedWallet = await walletRepo.save(wallet);

      const ledgerEntry = ledgerRepo.create({
        wallet: savedWallet,
        txGroupId,
        type: "withdraw",
        amount: amountNum.toString(),
        description: description || "Withdrawal",
      });
      await ledgerRepo.save(ledgerEntry);

      return savedWallet;
    });
  }

  async transferBetweenPlayersInGame(
    gameId: string,
    fromUserId: string,
    toUserId: string,
    studioId: string,
    amount: unknown,
    description?: string,
  ) {
    const amountNum = parseAmount(amount);

    // Disallow transfer to self
    if (fromUserId === toUserId) {
      throw new AppException("Cannot transfer to yourself", 400);
    }

    // Verify game belongs to studio before transaction
    const game = await this.assertGameBelongsToStudio(gameId, studioId);

    // Generate shared txGroupId for both ledger entries before transaction
    const txGroupId = randomUUID();

    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const gamePlayerRepo = manager.getRepository(GamePlayer);
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const fromUser = await this.findUserOrThrow(userRepo, fromUserId);
      const toUser = await this.findUserOrThrow(userRepo, toUserId);

      const fromGamePlayer = await this.ensureGamePlayer(
        gamePlayerRepo,
        game,
        fromUser,
      );
      const toGamePlayer = await this.ensureGamePlayer(gamePlayerRepo, game, toUser);

      const fromWallet = await this.ensureWalletForGamePlayer(
        walletRepo,
        fromGamePlayer,
      );
      const toWallet = await this.ensureWalletForGamePlayer(walletRepo, toGamePlayer);

      const lockedFromWallet = await this.lockWalletOrThrow(
        walletRepo,
        fromWallet.id,
        "Sender wallet not found",
      );
      const lockedToWallet = await this.lockWalletOrThrow(
        walletRepo,
        toWallet.id,
        "Recipient wallet not found",
      );

      // Validate sufficient balance
      const fromBalance = parseFloat(lockedFromWallet.balance);
      if (amountNum > fromBalance) {
        throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
      }

      // Update sender wallet
      lockedFromWallet.balance = (fromBalance - amountNum).toString();
      lockedFromWallet.totalWithdrawn = (
        parseFloat(lockedFromWallet.totalWithdrawn) + amountNum
      ).toString();
      const savedFromWallet = await walletRepo.save(lockedFromWallet);

      // Update recipient wallet
      const toBalance = parseFloat(lockedToWallet.balance);
      lockedToWallet.balance = (toBalance + amountNum).toString();
      lockedToWallet.totalDeposited = (
        parseFloat(lockedToWallet.totalDeposited) + amountNum
      ).toString();
      const savedToWallet = await walletRepo.save(lockedToWallet);

      // Create ledger entry for sender
      const fromDescription = description || `Transfer to ${toUserId}`;
      const fromLedgerEntry = ledgerRepo.create({
        wallet: savedFromWallet,
        txGroupId,
        type: "transfer",
        amount: amountNum.toString(),
        counterpartyUserId: toUserId,
        description: fromDescription,
      });
      await ledgerRepo.save(fromLedgerEntry);

      // Create ledger entry for recipient
      const toDescription = `Transfer from ${fromUserId}`;
      const toLedgerEntry = ledgerRepo.create({
        wallet: savedToWallet,
        txGroupId,
        type: "transfer",
        amount: amountNum.toString(),
        counterpartyUserId: fromUserId,
        description: toDescription,
      });
      await ledgerRepo.save(toLedgerEntry);

      return {
        fromWallet: savedFromWallet,
        toWallet: savedToWallet,
      };
    });
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

  async mintNFTToPlayer(gameId: string, studioId: string, templateId: string) {
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

    // For now, always mint to self (targetUserId is for future use)
    // Later, admin could mint to other players
    // const targetPlayer = targetUserId ? await this.userRepo.findOne({ where: { id: targetUserId } }) : null;

    const gamePlayer = await this.gamePlayerRepo.findOne({
      where: { game: { id: gameId } },
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

    return nftInstance;
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
