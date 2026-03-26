import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomUUID } from "crypto";
import { ethers, HDNodeWallet, Mnemonic } from "ethers";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { safeAdd, safeSub } from "../shared/safe-math";
import { User } from "../users/user.entity";
import { parseAmount } from "./parse-amount";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import {
  WalletDepositIntent,
  WalletDepositIntentStatus,
} from "./entities/wallet-deposit-intent.entity";

@Injectable()
export class GameWalletAdminService {
  private static readonly DEPOSIT_INTENT_TTL_MS = 15 * 60 * 1000;

  /**
   * BIP-44 account path for Ethereum (coin type 60, account 0, change 0).
   * The HD wallet is initialised at this depth; individual addresses are
   * derived via deriveChild(<uint32 index>) to produce m/44'/60'/0'/0/<index>.
   */
  private static readonly BIP44_ACCOUNT_PATH = "m/44'/60'/0'/0";

  private readonly logger = new Logger(GameWalletAdminService.name);
  private readonly rpcUrl = process.env.RPC_URL?.trim();
  private readonly rpcProvider = this.rpcUrl
    ? new ethers.JsonRpcProvider(this.rpcUrl)
    : null;

  /**
   * HD root wallet initialised from HD_WALLET_MNEMONIC at startup.
   * Null when the env var is not set (dev/test: falls back to fake addresses).
   */
  private readonly hdRoot: HDNodeWallet | null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(GameWallet)
    private readonly walletRepo: Repository<GameWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(WalletDepositIntent)
    private readonly walletDepositIntentRepo: Repository<WalletDepositIntent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    // Initialise BIP-44 HD root wallet from mnemonic (if configured).
    const phrase = process.env.HD_WALLET_MNEMONIC?.trim();
    if (phrase) {
      try {
        // Derive to the BIP-44 account path so individual addresses can be
        // obtained via deriveChild(index) without repeating the full path.
        this.hdRoot = HDNodeWallet.fromMnemonic(
          Mnemonic.fromPhrase(phrase),
          GameWalletAdminService.BIP44_ACCOUNT_PATH,
        );
        this.logger.log(
          "BIP-44 HD wallet loaded — real deposit addresses enabled.",
        );
      } catch {
        this.logger.error(
          "HD_WALLET_MNEMONIC is set but invalid — deposit address derivation disabled. " +
            "Falling back to deterministic fake addresses.",
        );
        this.hdRoot = null;
      }
    } else {
      this.hdRoot = null;
      this.logger.warn(
        "HD_WALLET_MNEMONIC is not set — using deterministic fake deposit addresses. " +
          "Set HD_WALLET_MNEMONIC in production for real BIP-44 addresses.",
      );
    }
  }

  /**
   * Derives a real BIP-44 Ethereum address for a deposit intent.
   *
   * Path: m/44'/60'/0'/0/<index>
   * Index: the first 4 bytes of SHA256(intentId) interpreted as uint32.
   * This is deterministic per intentId and collision-resistant for ~4B intents.
   *
   * Falls back to the deterministic fake address when HD_WALLET_MNEMONIC is
   * not configured (dev/test environments).
   */
  private deriveDepositAddress(intentId: string): string {
    if (!this.hdRoot) {
      // Dev fallback: deterministic hex address (NOT a real blockchain address)
      const hash = createHash("sha256").update(intentId).digest("hex");
      return `0x${hash.slice(0, 40)}`;
    }

    // hdRoot is at m/44'/60'/0'/0; deriveChild(index) gives the per-intent address
    const buf = createHash("sha256").update(intentId).digest();
    const index = buf.readUInt32BE(0);
    const child = this.hdRoot.deriveChild(index);
    return child.address;
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
      player = gamePlayerRepo.create({ user, game, level: 1, exp: 0 });
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

  private async assertGameBelongsToStudio(gameId: string, studioId: string) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) {
      throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    }
    return game;
  }

  async ensureGameWalletForPlayer(
    gameId: string,
    userId: string,
    studioId: string,
  ) {
    const game = await this.assertGameBelongsToStudio(gameId, studioId);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const gamePlayer = await this.ensureGamePlayer(
      this.gamePlayerRepo,
      game,
      user,
    );
    const wallet = await this.ensureWalletForGamePlayer(
      this.walletRepo,
      gamePlayer,
    );

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
    const { wallet } = await this.ensureGameWalletForPlayer(
      gameId,
      userId,
      studioId,
    );
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

    const txGroupId = randomUUID();

    return this.dataSource
      .transaction(async (manager) => {
        const walletRepo = manager.getRepository(GameWallet);
        const ledgerRepo = manager.getRepository(LedgerEntry);

        wallet.balance = safeAdd(wallet.balance, amountNum);
        wallet.totalDeposited = safeAdd(wallet.totalDeposited, amountNum);
        const savedWallet = await walletRepo.save(wallet);

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedWallet,
            txGroupId,
            type: "deposit",
            amount: amountNum.toString(),
            operationKey,
            description: description || "Deposit",
          }),
        );

        return savedWallet;
      })
      .catch(async (error: unknown) => {
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
            return this.getWalletByIdOrThrow(
              wallet.id,
              "Game wallet not found",
            );
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
      Date.now() + GameWalletAdminService.DEPOSIT_INTENT_TTL_MS,
    );
    const depositAddress = this.deriveDepositAddress(intentId);

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
          where: { id: intentId, game: { id: gameId }, user: { id: userId } },
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

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedWallet,
            txGroupId,
            type: "deposit",
            amount: intent.amount,
            intentId: intent.id,
            operationKey: this.normalizeIdempotencyKey(idempotencyKey),
            description: `External deposit txHash=${normalizedTxHash} intentId=${intent.id}`,
            txHash: normalizedTxHash,
          }),
        );

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

    if (amountNum > parseFloat(wallet.balance)) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    const txGroupId = randomUUID();
    return this.dataSource
      .transaction(async (manager) => {
        const walletRepo = manager.getRepository(GameWallet);
        const ledgerRepo = manager.getRepository(LedgerEntry);

        wallet.balance = safeSub(wallet.balance, amountNum);
        wallet.totalWithdrawn = safeAdd(wallet.totalWithdrawn, amountNum);
        const savedWallet = await walletRepo.save(wallet);

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedWallet,
            txGroupId,
            type: "withdraw",
            amount: amountNum.toString(),
            operationKey,
            description: description || "Withdrawal",
          }),
        );

        return savedWallet;
      })
      .catch(async (error: unknown) => {
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
            return this.getWalletByIdOrThrow(
              wallet.id,
              "Game wallet not found",
            );
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

    if (fromUserId === toUserId) {
      throw new AppException("Cannot transfer to yourself", 400);
    }

    const game = await this.assertGameBelongsToStudio(gameId, studioId);
    const txGroupId = randomUUID();

    return this.dataSource
      .transaction(async (manager) => {
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
        const creditOperationKey = operationKey
          ? `${operationKey}:credit`
          : null;

        if (debitOperationKey && creditOperationKey) {
          const [existingDebit, existingCredit] = await Promise.all([
            ledgerRepo.findOne({ where: { operationKey: debitOperationKey } }),
            ledgerRepo.findOne({ where: { operationKey: creditOperationKey } }),
          ]);
          if (existingDebit && existingCredit) {
            return this.getReplayWallets(fromWallet.id, toWallet.id);
          }
          if (existingDebit || existingCredit) {
            throw new AppException(
              "Transfer replay state is inconsistent",
              409,
            );
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

        if (amountNum > parseFloat(lockedFromWallet.balance)) {
          throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
        }

        lockedFromWallet.balance = safeSub(lockedFromWallet.balance, amountNum);
        lockedFromWallet.totalWithdrawn = safeAdd(
          lockedFromWallet.totalWithdrawn,
          amountNum,
        );
        const savedFromWallet = await walletRepo.save(lockedFromWallet);

        lockedToWallet.balance = safeAdd(lockedToWallet.balance, amountNum);
        lockedToWallet.totalDeposited = safeAdd(
          lockedToWallet.totalDeposited,
          amountNum,
        );
        const savedToWallet = await walletRepo.save(lockedToWallet);

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedFromWallet,
            txGroupId,
            type: "transfer",
            amount: amountNum.toString(),
            counterpartyUserId: toUserId,
            operationKey: debitOperationKey,
            description: description || `Transfer to ${toUserId}`,
          }),
        );

        await ledgerRepo.save(
          ledgerRepo.create({
            wallet: savedToWallet,
            txGroupId,
            type: "transfer",
            amount: amountNum.toString(),
            counterpartyUserId: fromUserId,
            operationKey: creditOperationKey,
            description: `Transfer from ${fromUserId}`,
          }),
        );

        return { fromWallet: savedFromWallet, toWallet: savedToWallet };
      })
      .catch(async (error: unknown) => {
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

  async getGamePlayers(gameId: string, studioId: string) {
    await this.assertGameBelongsToStudio(gameId, studioId);
    return this.gamePlayerRepo.find({
      where: { game: { id: gameId } },
      relations: ["user", "studioUser"],
      order: { joinedAt: "ASC" },
    });
  }
}
