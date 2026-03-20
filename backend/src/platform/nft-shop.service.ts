import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { safeAdd, safeSub } from "../shared/safe-math";
import { Game } from "./entities/game.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";

@Injectable()
export class NFTShopService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameWallet)
    private readonly walletRepo: Repository<GameWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(NFTInstance)
    private readonly nftInstanceRepo: Repository<NFTInstance>,
    @InjectRepository(NFTTemplate)
    private readonly nftTemplateRepo: Repository<NFTTemplate>,
    private readonly playerWalletIdentityService: PlayerWalletIdentityService,
  ) {}

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
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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
}
