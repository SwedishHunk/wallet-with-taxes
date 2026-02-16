import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { Studio } from "./entities/studio.entity";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { User } from "../users/user.entity";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";

@Injectable()
export class PlatformService {
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
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

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
    const { gamePlayer, wallet } = await this.ensureGameWalletForPlayer(
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
    amount: string,
    description?: string,
  ) {
    // Validate amount is positive before any DB operations
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      throw new AppException("Amount must be positive", 400);
    }

    const { gamePlayer, wallet } = await this.ensureGameWalletForPlayer(
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
        amount,
        description: description || "Deposit",
      });
      await ledgerRepo.save(ledgerEntry);

      return savedWallet;
    });
  }

  async withdrawFromGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: string,
    description?: string,
  ) {
    const wallet = await this.getGameWalletBalance(gameId, userId, studioId);
    const amountNum = parseFloat(amount);

    // Validate amount is positive before any DB operations
    if (amountNum <= 0) {
      throw new AppException("Amount must be positive", 400);
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
        amount,
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
    amount: string,
    description?: string,
  ) {
    // Validate amount is positive
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      throw new AppException("Amount must be positive", 400);
    }

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

      // Get users
      const fromUser = await userRepo.findOne({ where: { id: fromUserId } });
      if (!fromUser) {
        throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }
      const toUser = await userRepo.findOne({ where: { id: toUserId } });
      if (!toUser) {
        throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      // Ensure from player exists and get wallet
      let fromGamePlayer = await gamePlayerRepo.findOne({
        where: { user: { id: fromUserId }, game: { id: gameId } },
        relations: ["game", "user"],
      });
      if (!fromGamePlayer) {
        fromGamePlayer = gamePlayerRepo.create({
          user: fromUser,
          game,
        });
        fromGamePlayer = await gamePlayerRepo.save(fromGamePlayer);
      }

      let fromWallet = await walletRepo.findOne({
        where: { gamePlayer: { id: fromGamePlayer.id } },
      });
      if (!fromWallet) {
        fromWallet = walletRepo.create({
          gamePlayer: fromGamePlayer,
          balance: "0",
          totalDeposited: "0",
          totalWithdrawn: "0",
        });
        fromWallet = await walletRepo.save(fromWallet);
      }

      // Ensure to player exists and get wallet
      let toGamePlayer = await gamePlayerRepo.findOne({
        where: { user: { id: toUserId }, game: { id: gameId } },
        relations: ["game", "user"],
      });
      if (!toGamePlayer) {
        toGamePlayer = gamePlayerRepo.create({
          user: toUser,
          game,
        });
        toGamePlayer = await gamePlayerRepo.save(toGamePlayer);
      }

      let toWallet = await walletRepo.findOne({
        where: { gamePlayer: { id: toGamePlayer.id } },
      });
      if (!toWallet) {
        toWallet = walletRepo.create({
          gamePlayer: toGamePlayer,
          balance: "0",
          totalDeposited: "0",
          totalWithdrawn: "0",
        });
        toWallet = await walletRepo.save(toWallet);
      }

      // Lock both wallets pessimistically for write
      const lockedFromWallet = await walletRepo.findOne({
        where: { id: fromWallet.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedFromWallet) {
        throw new AppException("Sender wallet not found", 404);
      }

      const lockedToWallet = await walletRepo.findOne({
        where: { id: toWallet.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedToWallet) {
        throw new AppException("Recipient wallet not found", 404);
      }

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
        amount,
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
        amount,
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

  async mintNFTToPlayer(
    gameId: string,
    studioId: string,
    templateId: string,
    targetUserId?: string,
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

    // For now, always mint to self (targetUserId is for future use)
    // Later, admin could mint to other players
    // const targetPlayer = targetUserId ? await this.userRepo.findOne({ where: { id: targetUserId } }) : null;

    let gamePlayer = await this.gamePlayerRepo.findOne({
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

  async createPersonalAccount(
    studioId: string,
    email: string,
    password: string,
    accessPoints?: Record<string, boolean>,
  ) {
    throw new AppException("Not implemented", 501);
  }

  async getStudioUsers(studioId: string) {
    throw new AppException("Not implemented", 501);
  }

  async loginStudioUser(studioId: string, email: string, password: string) {
    throw new AppException("Not implemented", 501);
  }

  async updatePersonalAccountPermissions(
    studioId: string,
    userId: string,
    accessPoints: Record<string, boolean>,
  ) {
    throw new AppException("Not implemented", 501);
  }
}
