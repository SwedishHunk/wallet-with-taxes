import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { parseAmount } from "./parse-amount";
import { safeAdd, safeSub } from "../shared/safe-math";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";
import { User } from "../users/user.entity";
import { AmlMonitorService } from "../aml/aml-monitor.service";

@Injectable()
export class PlayerWalletOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GameWallet)
    private readonly walletRepo: Repository<GameWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(NFTInstance)
    private readonly nftInstanceRepo: Repository<NFTInstance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly playerWalletIdentityService: PlayerWalletIdentityService,
    private readonly amlMonitorService: AmlMonitorService,
  ) {}

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

  async playerWithdrawFromGameWallet(
    gameId: string,
    walletAddress: string,
    amount: unknown,
    idempotencyKey?: string,
  ) {
    const amountNum = parseAmount(amount);
    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

    // KYC gate — custodial users must be verified before withdrawing real value
    const user = await this.userRepo.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: ["id", "custodyMode", "kycStatus"],
    });
    if (user?.custodyMode === "custodial" && user.kycStatus !== "verified") {
      throw new AppException(
        "Identity verification (KYC) is required before withdrawing. Please complete verification.",
        403,
      );
    }

    // AML monitoring — flag withdrawals that exceed the €10,000 USD threshold.
    // TRI/USD price is not always available; pass null when unknown so the
    // service logs a warning rather than silently skipping.
    const triUsdPrice = this.getTRIUSDPrice();
    const amountUsd = triUsdPrice !== null ? amountNum * triUsdPrice : null;
    await this.amlMonitorService.checkAndFlag({
      userAddress: walletAddress,
      amountUsd,
      txType: "withdrawal",
      context: { gameId, amountTRI: amountNum },
    });

    const { wallet } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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
    return this.dataSource
      .transaction(async (manager) => {
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
              "Player wallet not found",
            );
          }
        }
        throw error;
      });
  }

  /**
   * Returns the current TRI/USD price from the environment variable
   * TRI_USD_PRICE, or null when not configured.
   *
   * This is a temporary approach — in production this should be replaced with
   * a live price feed from ExchangeRateService once TRI has a CoinGecko listing.
   */
  private getTRIUSDPrice(): number | null {
    const raw = process.env.TRI_USD_PRICE;
    if (!raw) return null;
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
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

    const { wallet: fromWallet } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
        gameId,
        normalizedFrom,
      );
    const { wallet: toWallet } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
        gameId,
        normalizedTo,
      );

    const debitOperationKey = operationKey ? `${operationKey}:debit` : null;
    const creditOperationKey = operationKey ? `${operationKey}:credit` : null;

    if (debitOperationKey && creditOperationKey) {
      const [existingDebit, existingCredit] = await Promise.all([
        this.ledgerRepo.findOne({ where: { operationKey: debitOperationKey } }),
        this.ledgerRepo.findOne({
          where: { operationKey: creditOperationKey },
        }),
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
    return this.dataSource
      .transaction(async (manager) => {
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
        lockedFrom.totalWithdrawn = safeAdd(
          lockedFrom.totalWithdrawn,
          amountNum,
        );
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

    const { gamePlayer: fromGamePlayer } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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

    const { gamePlayer: toGamePlayer } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
        gameId,
        normalizedTo,
      );

    nftInstance.owner = toGamePlayer;
    return this.nftInstanceRepo.save(nftInstance);
  }
}
