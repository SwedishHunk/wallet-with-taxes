import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
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
import {
  WalletDepositIntent,
  WalletDepositIntentStatus,
} from "./entities/wallet-deposit-intent.entity";
import { MarketplaceListing } from "./entities/marketplace-listing.entity";
import { PlayerWalletIdentity } from "./entities/player-wallet-identity.entity";
import { User } from "../users/user.entity";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { parseAmount } from "./parse-amount";
import { safeAdd, safeSub } from "../shared/safe-math";
import { EconomicsService } from "../economics/economics.service";
import {
  EconomicDirection,
  EconomicScopeType,
} from "../economics/entities/economic-event.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";

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

  private async resolvePlayerGameWallet(
    gameId: string,
    walletAddress: string,
  ) {
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
      throw new AppException("idempotencyKey must be 128 characters or less", 400);
    }
    return normalized;
  }

  private async getWalletByIdOrThrow(walletId: string, notFoundMessage: string) {
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
    idempotencyKey?: string,
  ) {
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );

    if (operationKey) {
      const existing = await this.ledgerRepo.findOne({
        where: { operationKey },
      });
      if (existing) {
        return this.getWalletByIdOrThrow(wallet.id, "Game wallet not found");
      }
    }

    // Generate txGroupId for this transaction
    const txGroupId = randomUUID();

    return await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const newBalance = safeAdd(wallet.balance, amountNum);

      wallet.balance = newBalance;
      wallet.totalDeposited = safeAdd(wallet.totalDeposited, amountNum);
      const savedWallet = await walletRepo.save(wallet);

      const ledgerEntry = ledgerRepo.create({
        wallet: savedWallet,
        txGroupId,
        type: "deposit",
        amount: amountNum.toString(),
        operationKey,
        description: description || "Deposit",
      });
      await ledgerRepo.save(ledgerEntry);

      return savedWallet;
    }).catch(async (error: unknown) => {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          return this.getWalletByIdOrThrow(wallet.id, "Game wallet not found");
        }
      }
      throw error;
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
    idempotencyKey?: string,
  ) {
    if (!this.isValidTxHash(txHash)) {
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

        if (
          intent.status === WalletDepositIntentStatus.CONFIRMED &&
          intent.txHash === normalizedTxHash
        ) {
          const existingWallet = await walletRepo.findOne({
            where: { id: wallet.id },
          });
          if (!existingWallet) {
            throw new AppException("Game wallet not found", 404);
          }
          return { expired: false as const, wallet: existingWallet };
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

        await this.verifyNativeDepositTransaction(intent, normalizedTxHash);

        const lockedWallet = await walletRepo.findOne({
          where: { id: wallet.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!lockedWallet) {
          throw new AppException("Game wallet not found", 404);
        }

        const amountNum = parseFloat(intent.amount);
        lockedWallet.balance = safeAdd(lockedWallet.balance, amountNum);
        lockedWallet.totalDeposited = safeAdd(
          lockedWallet.totalDeposited,
          amountNum,
        );
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
          operationKey: this.normalizeIdempotencyKey(idempotencyKey),
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
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          return this.getWalletByIdOrThrow(wallet.id, "Game wallet not found");
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
    idempotencyKey?: string,
  ) {
    const wallet = await this.getGameWalletBalance(gameId, userId, studioId);
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

    if (operationKey) {
      const existing = await this.ledgerRepo.findOne({
        where: { operationKey },
      });
      if (existing) {
        return this.getWalletByIdOrThrow(wallet.id, "Game wallet not found");
      }
    }

    const balanceNum = parseFloat(wallet.balance);

    if (amountNum > balanceNum) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    // Generate txGroupId for this transaction
    const txGroupId = randomUUID();

    return await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const newBalance = safeSub(wallet.balance, amountNum);
      wallet.balance = newBalance;
      wallet.totalWithdrawn = safeAdd(wallet.totalWithdrawn, amountNum);
      const savedWallet = await walletRepo.save(wallet);

      const ledgerEntry = ledgerRepo.create({
        wallet: savedWallet,
        txGroupId,
        type: "withdraw",
        amount: amountNum.toString(),
        operationKey,
        description: description || "Withdrawal",
      });
      await ledgerRepo.save(ledgerEntry);

      return savedWallet;
    }).catch(async (error: unknown) => {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          return this.getWalletByIdOrThrow(wallet.id, "Game wallet not found");
        }
      }
      throw error;
    });
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
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

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
      const toGamePlayer = await this.ensureGamePlayer(
        gamePlayerRepo,
        game,
        toUser,
      );

      const fromWallet = await this.ensureWalletForGamePlayer(
        walletRepo,
        fromGamePlayer,
      );
      const toWallet = await this.ensureWalletForGamePlayer(
        walletRepo,
        toGamePlayer,
      );

      const debitOperationKey = operationKey ? `${operationKey}:debit` : null;
      const creditOperationKey = operationKey ? `${operationKey}:credit` : null;

      if (debitOperationKey && creditOperationKey) {
        const [existingDebit, existingCredit] = await Promise.all([
          ledgerRepo.findOne({ where: { operationKey: debitOperationKey } }),
          ledgerRepo.findOne({ where: { operationKey: creditOperationKey } }),
        ]);
        if (existingDebit && existingCredit) {
          return this.getReplayWallets(fromWallet.id, toWallet.id);
        }
        if (existingDebit || existingCredit) {
          throw new AppException("Transfer replay state is inconsistent", 409);
        }
      }

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
      lockedFromWallet.balance = safeSub(lockedFromWallet.balance, amountNum);
      lockedFromWallet.totalWithdrawn = safeAdd(
        lockedFromWallet.totalWithdrawn,
        amountNum,
      );
      const savedFromWallet = await walletRepo.save(lockedFromWallet);

      // Update recipient wallet
      lockedToWallet.balance = safeAdd(lockedToWallet.balance, amountNum);
      lockedToWallet.totalDeposited = safeAdd(
        lockedToWallet.totalDeposited,
        amountNum,
      );
      const savedToWallet = await walletRepo.save(lockedToWallet);

      // Create ledger entry for sender
      const fromDescription = description || `Transfer to ${toUserId}`;
      const fromLedgerEntry = ledgerRepo.create({
        wallet: savedFromWallet,
        txGroupId,
        type: "transfer",
        amount: amountNum.toString(),
        counterpartyUserId: toUserId,
        operationKey: debitOperationKey,
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
        operationKey: creditOperationKey,
        description: toDescription,
      });
      await ledgerRepo.save(toLedgerEntry);

      return {
        fromWallet: savedFromWallet,
        toWallet: savedToWallet,
      };
    }).catch(async (error: unknown) => {
      if (error instanceof QueryFailedError && operationKey) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          const replayToUser = await this.userRepo.findOne({
            where: { id: toUserId },
          });
          if (!replayToUser) {
            throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
          }
          const replayFrom = await this.ensureGameWalletForPlayer(
            gameId,
            fromUserId,
            studioId,
          );
          const replayGame = await this.assertGameBelongsToStudio(
            gameId,
            studioId,
          );
          const replayToPlayer = await this.ensureGamePlayer(
            this.gamePlayerRepo,
            replayGame,
            replayToUser,
          );
          const replayToWallet = await this.ensureWalletForGamePlayer(
            this.walletRepo,
            replayToPlayer,
          );
          return this.getReplayWallets(
            replayFrom.wallet.id,
            replayToWallet.id,
          );
        }
      }
      throw error;
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
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);
    const { wallet } = await this.resolvePlayerGameWallet(
      gameId,
      walletAddress,
    );

    if (operationKey) {
      const existing = await this.ledgerRepo.findOne({
        where: { operationKey },
      });
      if (existing) {
        return this.getWalletByIdOrThrow(wallet.id, "Player wallet not found");
      }
    }

    if (amountNum > parseFloat(wallet.balance)) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    const txGroupId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      wallet.balance = safeSub(wallet.balance, amountNum);
      wallet.totalWithdrawn = safeAdd(wallet.totalWithdrawn, amountNum);
      const saved = await walletRepo.save(wallet);

      await ledgerRepo.save(
        ledgerRepo.create({
          wallet: saved,
          txGroupId,
          type: "withdraw",
          amount: amountNum.toString(),
          operationKey,
          description: "Player withdrawal",
        }),
      );
      return saved;
    }).catch(async (error: unknown) => {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          return this.getWalletByIdOrThrow(wallet.id, "Player wallet not found");
        }
      }
      throw error;
    });
  }

  async playerTransferBetweenPlayers(
    gameId: string,
    fromWalletAddress: string,
    toWalletAddress: string,
    amount: unknown,
    idempotencyKey?: string,
  ) {
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);
    const normalizedFrom = fromWalletAddress.toLowerCase();
    const normalizedTo = toWalletAddress.toLowerCase();

    if (normalizedFrom === normalizedTo) {
      throw new AppException("Cannot transfer to yourself", 400);
    }

    const { wallet: fromWallet } = await this.resolvePlayerGameWallet(
      gameId,
      normalizedFrom,
    );
    const { wallet: toWallet } = await this.resolvePlayerGameWallet(
      gameId,
      normalizedTo,
    );

    const debitOperationKey = operationKey ? `${operationKey}:debit` : null;
    const creditOperationKey = operationKey ? `${operationKey}:credit` : null;

    if (debitOperationKey && creditOperationKey) {
      const [existingDebit, existingCredit] = await Promise.all([
        this.ledgerRepo.findOne({ where: { operationKey: debitOperationKey } }),
        this.ledgerRepo.findOne({ where: { operationKey: creditOperationKey } }),
      ]);
      if (existingDebit && existingCredit) {
        return this.getReplayWallets(fromWallet.id, toWallet.id);
      }
      if (existingDebit || existingCredit) {
        throw new AppException("Transfer replay state is inconsistent", 409);
      }
    }

    if (amountNum > parseFloat(fromWallet.balance)) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    const txGroupId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);

      const lockedFrom = await this.lockWalletOrThrow(
        walletRepo,
        fromWallet.id,
        "Sender wallet not found",
      );
      const lockedTo = await this.lockWalletOrThrow(
        walletRepo,
        toWallet.id,
        "Recipient wallet not found",
      );

      if (amountNum > parseFloat(lockedFrom.balance)) {
        throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
      }

      lockedFrom.balance = safeSub(lockedFrom.balance, amountNum);
      lockedFrom.totalWithdrawn = safeAdd(lockedFrom.totalWithdrawn, amountNum);
      const savedFrom = await walletRepo.save(lockedFrom);

      lockedTo.balance = safeAdd(lockedTo.balance, amountNum);
      lockedTo.totalDeposited = safeAdd(lockedTo.totalDeposited, amountNum);
      const savedTo = await walletRepo.save(lockedTo);

      await ledgerRepo.save(
        ledgerRepo.create({
          wallet: savedFrom,
          txGroupId,
          type: "transfer",
          amount: amountNum.toString(),
          operationKey: debitOperationKey,
          description: `Transfer to ${normalizedTo}`,
        }),
      );
      await ledgerRepo.save(
        ledgerRepo.create({
          wallet: savedTo,
          txGroupId,
          type: "transfer",
          amount: amountNum.toString(),
          operationKey: creditOperationKey,
          description: `Transfer from ${normalizedFrom}`,
        }),
      );

      return { fromWallet: savedFrom, toWallet: savedTo };
    }).catch(async (error: unknown) => {
      if (error instanceof QueryFailedError && operationKey) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string; constraint?: string };
          }
        ).driverError;
        if (
          driverError?.code === "23505" &&
          driverError?.constraint === "uq_ledger_operation_key_not_null"
        ) {
          return this.getReplayWallets(fromWallet.id, toWallet.id);
        }
      }
      throw error;
    });
  }

  async playerTransferNFT(
    gameId: string,
    fromWalletAddress: string,
    toWalletAddress: string,
    nftInstanceId: string,
  ) {
    const normalizedFrom = fromWalletAddress.toLowerCase();
    const normalizedTo = toWalletAddress.toLowerCase();

    if (normalizedFrom === normalizedTo) {
      throw new AppException("Cannot transfer to yourself", 400);
    }

    const { gamePlayer: fromGamePlayer } = await this.resolvePlayerGameWallet(
      gameId,
      normalizedFrom,
    );

    const nftInstance = await this.nftInstanceRepo.findOne({
      where: {
        id: nftInstanceId,
        owner: { id: fromGamePlayer.id },
        template: { game: { id: gameId } },
      },
      relations: ["owner", "template"],
    });

    if (!nftInstance) {
      throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);
    }

    const { gamePlayer: toGamePlayer } = await this.resolvePlayerGameWallet(
      gameId,
      normalizedTo,
    );

    nftInstance.owner = toGamePlayer;
    return this.nftInstanceRepo.save(nftInstance);
  }

  // ─── Marketplace ───────────────────────────────────────────────────────────

  async getGameListings(gameId: string) {
    return this.marketplaceListingRepo.find({
      where: { game: { id: gameId }, status: "active" },
      relations: { nftInstance: { template: true }, seller: { user: true } },
      order: { createdAt: "DESC" },
    });
  }

  async createNFTListing(
    gameId: string,
    walletAddress: string,
    nftInstanceId: string,
    askPrice: string,
  ) {
    const normalized = walletAddress.toLowerCase();
    const { gamePlayer } = await this.resolvePlayerGameWallet(
      gameId,
      normalized,
    );

    const nftInstance = await this.nftInstanceRepo.findOne({
      where: {
        id: nftInstanceId,
        owner: { id: gamePlayer.id },
        template: { game: { id: gameId } },
      },
      relations: ["owner", "template"],
    });
    if (!nftInstance) {
      throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);
    }

      const existing = await this.marketplaceListingRepo.findOne({
        where: { nftInstance: { id: nftInstanceId }, status: "active" },
        relations: ["seller"],
      });
      if (existing) {
        if (existing.seller?.id === gamePlayer.id) {
          return existing;
        }
        throw new AppException(
          "This NFT is already listed in the marketplace",
          409,
        );
      }

    const game = await this.gameRepo.findOneBy({ id: gameId });
    if (!game) throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);

    const listing = this.marketplaceListingRepo.create({
      game,
      seller: gamePlayer,
      nftInstance,
      askPrice: String(parseAmount(askPrice)),
      status: "active",
    });
    return this.marketplaceListingRepo.save(listing);
  }

  async cancelNFTListing(
    gameId: string,
    walletAddress: string,
    listingId: string,
  ) {
    const normalized = walletAddress.toLowerCase();
    const { gamePlayer } = await this.resolvePlayerGameWallet(
      gameId,
      normalized,
    );

      const listing = await this.marketplaceListingRepo.findOne({
        where: { id: listingId, game: { id: gameId } },
        relations: ["seller"],
      });
      if (!listing) throw new AppException("Listing not found", 404);
      if (listing.seller.id !== gamePlayer.id) {
        throw new AppException("Not your listing", 403);
      }
      if (listing.status === "cancelled") {
        return listing;
      }
      if (listing.status !== "active") {
        throw new AppException("Listing is no longer active", 409);
      }

      listing.status = "cancelled";
      return this.marketplaceListingRepo.save(listing);
    }

  async purchaseNFTListing(
    gameId: string,
    walletAddress: string,
    listingId: string,
  ) {
    const normalized = walletAddress.toLowerCase();
    const { gamePlayer: buyerPlayer, wallet: buyerWallet } =
      await this.resolvePlayerGameWallet(
        gameId,
        normalized,
      );
    const txGroupId = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(GameWallet);
      const ledgerRepo = manager.getRepository(LedgerEntry);
      const listingRepo = manager.getRepository(MarketplaceListing);
      const nftInstanceRepo = manager.getRepository(NFTInstance);

        const listing = await listingRepo.findOne({
          where: { id: listingId, game: { id: gameId } },
          relations: ["seller", "buyer", "nftInstance", "nftInstance.owner"],
          lock: { mode: "pessimistic_write" },
        });

        if (!listing) {
          throw new AppException("Listing not found or no longer active", 404);
        }
        if (listing.status === "sold" && listing.buyer?.id === buyerPlayer.id) {
          return listing;
        }
        if (listing.status !== "active") {
          throw new AppException("Listing not found or no longer active", 404);
        }
        if (listing.seller.id === buyerPlayer.id) {
          throw new AppException("Cannot purchase your own listing", 400);
        }

      const ask = parseAmount(listing.askPrice);
      const lockedBuyerWallet = await this.lockWalletOrThrow(
        walletRepo,
        buyerWallet.id,
        "Buyer wallet not found",
      );
      if (ask > parseFloat(lockedBuyerWallet.balance ?? "0")) {
        throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 402);
      }

      const sellerWallet = await walletRepo.findOne({
        where: { gamePlayer: { id: listing.seller.id } },
        lock: { mode: "pessimistic_write" },
      });
      if (!sellerWallet) {
        throw new AppException("Seller wallet not found", 404);
      }

      const lockedNftInstance = await nftInstanceRepo.findOne({
        where: { id: listing.nftInstance.id },
        relations: ["owner"],
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedNftInstance) {
        throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);
      }
      if (lockedNftInstance.owner?.id !== listing.seller.id) {
        throw new AppException("Listing is no longer valid", 409);
      }

      lockedBuyerWallet.balance = safeSub(lockedBuyerWallet.balance ?? "0", ask);
      lockedBuyerWallet.totalWithdrawn = safeAdd(
        lockedBuyerWallet.totalWithdrawn ?? "0",
        ask,
      );
      const savedBuyerWallet = await walletRepo.save(lockedBuyerWallet);

      sellerWallet.balance = safeAdd(sellerWallet.balance ?? "0", ask);
      sellerWallet.totalDeposited = safeAdd(
        sellerWallet.totalDeposited ?? "0",
        ask,
      );
      const savedSellerWallet = await walletRepo.save(sellerWallet);

      await ledgerRepo.save(
        ledgerRepo.create({
          wallet: savedBuyerWallet,
          txGroupId,
          type: "spend",
          amount: ask.toString(),
          description: `Marketplace purchase listing=${listing.id}`,
        }),
      );
      await ledgerRepo.save(
        ledgerRepo.create({
          wallet: savedSellerWallet,
          txGroupId,
          type: "earn",
          amount: ask.toString(),
          description: `Marketplace sale listing=${listing.id}`,
        }),
      );

      lockedNftInstance.owner = buyerPlayer;
      await nftInstanceRepo.save(lockedNftInstance);

      listing.status = "sold";
      listing.buyer = buyerPlayer;
      listing.soldAt = new Date();

      return listingRepo.save(listing);
    });
  }

  // ─── NFT Shop (player-facing) ───────────────────────────────────────────────

  async getNFTShopTemplates(gameId: string) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);

    const all = await this.nftTemplateRepo.find({
      where: { game: { id: gameId } },
    });
    return all.filter((t) => parseFloat(t.mintingCost) > 0);
  }

  async purchaseNFTFromShop(
    gameId: string,
    walletAddress: string,
    templateId: string,
    idempotencyKey?: string,
  ) {
    const template = await this.nftTemplateRepo.findOne({
      where: { id: templateId, game: { id: gameId } },
      relations: ["game"],
    });
    if (!template) throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);

    if (
      template.maxMintCount &&
      template.currentMintCount >= template.maxMintCount
    ) {
      throw new AppException("Max mint count reached for this NFT", 400);
    }

    const mintingCost = parseFloat(template.mintingCost);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);
    const { gamePlayer, wallet } =
      await this.resolvePlayerGameWallet(
      gameId,
      walletAddress,
      );

    if (operationKey) {
      const existingPurchase = await this.nftInstanceRepo.findOne({
        where: {
          purchaseOperationKey: operationKey,
          owner: { id: gamePlayer.id },
          template: { id: template.id },
        },
        relations: ["owner", "template"],
      });
      if (existingPurchase) {
        return {
          nft: existingPurchase,
          wallet: await this.getWalletByIdOrThrow(
            wallet.id,
            "Player wallet not found",
          ),
        };
      }
    }

    if (mintingCost > parseFloat(wallet.balance)) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    const txGroupId = randomUUID();

    return this.dataSource
      .transaction(async (manager) => {
        const walletRepo = manager.getRepository(GameWallet);
        const ledgerRepo = manager.getRepository(LedgerEntry);
        const nftInstanceRepo = manager.getRepository(NFTInstance);
        const nftTemplateRepo = manager.getRepository(NFTTemplate);

        const lockedWallet = await this.lockWalletOrThrow(
          walletRepo,
          wallet.id,
          "Player wallet not found",
        );

        if (operationKey) {
          const existingPurchase = await nftInstanceRepo.findOne({
            where: {
              purchaseOperationKey: operationKey,
              owner: { id: gamePlayer.id },
              template: { id: template.id },
            },
            relations: ["owner", "template"],
          });
          if (existingPurchase) {
            return { nft: existingPurchase, wallet: lockedWallet };
          }
        }

        if (mintingCost > parseFloat(lockedWallet.balance)) {
          throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
        }

        lockedWallet.balance = safeSub(lockedWallet.balance, mintingCost);
        lockedWallet.totalWithdrawn = safeAdd(
          lockedWallet.totalWithdrawn,
          mintingCost,
        );
        const savedWallet = await walletRepo.save(lockedWallet);

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedWallet,
            txGroupId,
            type: "withdraw",
            amount: mintingCost.toString(),
            operationKey,
            description: `NFT purchase: ${template.name}`,
          }),
        );

        const nftInstance = nftInstanceRepo.create({
          template,
          owner: gamePlayer,
          purchaseOperationKey: operationKey,
          name: `${template.name} #${template.currentMintCount + 1}`,
          level: 1,
          condition: 100,
          power: 0,
          customAttributes: {},
          equipped: false,
        });
        const savedInstance = await nftInstanceRepo.save(nftInstance);

        template.currentMintCount += 1;
        await nftTemplateRepo.save(template);

        return { nft: savedInstance, wallet: savedWallet };
      })
      .catch(async (error: unknown) => {
        if (error instanceof QueryFailedError && operationKey) {
          const driverError = (
            error as QueryFailedError & {
              driverError?: { code?: string; constraint?: string };
            }
          ).driverError;
          if (driverError?.code === "23505") {
            const existingPurchase = await this.nftInstanceRepo.findOne({
              where: {
                purchaseOperationKey: operationKey,
                owner: { id: gamePlayer.id },
                template: { id: template.id },
              },
              relations: ["owner", "template"],
            });
            if (existingPurchase) {
              return {
                nft: existingPurchase,
                wallet: await this.getWalletByIdOrThrow(
                  wallet.id,
                  "Player wallet not found",
                ),
              };
            }
          }
        }
        throw error;
      });
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
    await this.assertGameBelongsToStudio(gameId, studioId);
    return this.gamePlayerRepo.find({
      where: { game: { id: gameId } },
      relations: ["user", "studioUser"],
      order: { joinedAt: "ASC" },
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
