import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";
import { parseAmount } from "./parse-amount";
import { safeAdd, safeSub } from "../shared/safe-math";
import { Game } from "./entities/game.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { MarketplaceListing } from "./entities/marketplace-listing.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";

@Injectable()
export class MarketplaceService {
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
    @InjectRepository(MarketplaceListing)
    private readonly marketplaceListingRepo: Repository<MarketplaceListing>,
    private readonly playerWalletIdentityService: PlayerWalletIdentityService,
  ) {}

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
    const { gamePlayer } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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
    if (!game) {
      throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    }

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
    const { gamePlayer } =
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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
      await this.playerWalletIdentityService.resolvePlayerGameWallet(
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
}
