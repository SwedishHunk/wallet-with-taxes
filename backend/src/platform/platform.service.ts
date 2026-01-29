import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Studio } from "./entities/studio.entity";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { StudioUser, StudioUserRole } from "./entities/studio-user.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { User } from "../users/user.entity";
import * as bcrypt from "bcryptjs";
import { AppException } from "../common/exceptions/app-exception";
import { ERROR_MESSAGES } from "../shared/constants/error-messages";

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(Studio)
    private studioRepo: Repository<Studio>,
    @InjectRepository(StudioMember)
    private studioMemberRepo: Repository<StudioMember>,
    @InjectRepository(StudioUser)
    private studioUserRepo: Repository<StudioUser>,
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

  async ensureStudioForUser(userId: string) {
    const studio = await this.studioRepo.findOne({
      where: { members: { user: { id: userId } } },
      relations: ['members'],
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
      .createQueryBuilder('studio')
      .leftJoinAndSelect('studio.members', 'members')
      .where('members.user_id = :userId', { userId })
      .getMany();
  }

  async getStudioWithRoleForUser(studioId: string, userId: string) {
    const member = await this.studioMemberRepo.findOne({
      where: { studio: { id: studioId }, user: { id: userId } },
      relations: ['studio'],
    });
    if (!member) throw new AppException(ERROR_MESSAGES.ACCESS_DENIED, 403);
    return { studio: member.studio, role: member.role };
  }

  async createGameForUser(userId: string, studioId: string, data: { name: string; slug: string }) {
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
      relations: ['studio'],
    });
    if (!game) throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);
    return game;
  }

  async ensureGameWalletForPlayer(gameId: string, userId: string, studioId: string) {
    // Verify game belongs to this studio
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
      relations: ['studio'],
    });
    if (!game) throw new AppException(ERROR_MESSAGES.GAME_NOT_FOUND, 404);

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
        balance: '0',
        totalDeposited: '0',
        totalWithdrawn: '0',
      });
      wallet = await this.walletRepo.save(wallet);
    }

    return { gamePlayer, wallet };
  }

  async getGameWalletBalance(gameId: string, userId: string, studioId: string) {
    const { gamePlayer, wallet } = await this.ensureGameWalletForPlayer(gameId, userId, studioId);
    return wallet;
  }

  async depositToGameWallet(
    gameId: string,
    userId: string,
    studioId: string,
    amount: string,
    description?: string,
  ) {
    const { gamePlayer, wallet } = await this.ensureGameWalletForPlayer(gameId, userId, studioId);
    const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toString();

    wallet.balance = newBalance;
    wallet.totalDeposited = (parseFloat(wallet.totalDeposited) + parseFloat(amount)).toString();
    await this.walletRepo.save(wallet);

    const ledgerEntry = this.ledgerRepo.create({
      wallet,
      type: 'deposit',
      amount,
      description: description || 'Deposit',
    });
    await this.ledgerRepo.save(ledgerEntry);

    return wallet;
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
    const balanceNum = parseFloat(wallet.balance);

    if (amountNum > balanceNum) {
      throw new AppException(ERROR_MESSAGES.INSUFFICIENT_BALANCE, 400);
    }

    const newBalance = (balanceNum - amountNum).toString();
    wallet.balance = newBalance;
    wallet.totalWithdrawn = (parseFloat(wallet.totalWithdrawn) + amountNum).toString();
    await this.walletRepo.save(wallet);

    const ledgerEntry = this.ledgerRepo.create({
      wallet,
      type: 'withdraw',
      amount,
      description: description || 'Withdrawal',
    });
    await this.ledgerRepo.save(ledgerEntry);

    return wallet;
  }

  // NFT Methods

  async getNFTTemplatesForGame(gameId: string, studioId: string) {
    // Verify game belongs to studio
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) throw new Error('Game not found or access denied');

    return this.nftTemplateRepo.find({
      where: { game: { id: gameId } },
      relations: ['game'],
    });
  }

  async getPlayerNFTs(gameId: string, userId: string, studioId: string) {
    // Verify game belongs to studio
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) throw new Error('Game not found or access denied');

    const { gamePlayer } = await this.ensureGameWalletForPlayer(gameId, userId, studioId);

    return this.nftInstanceRepo.find({
      where: { owner: { id: gamePlayer.id } },
      relations: ['template', 'owner'],
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
    const game = await this.gameRepo.findOne({
      where: { id: gameId, studio: { id: studioId } },
    });
    if (!game) throw new Error('Game not found or access denied');

    const template = this.nftTemplateRepo.create({
      game,
      name: data.name,
      tier: data.tier || 1,
      attributes: data.attributes || {},
      upkeepCostPerDay: data.upkeepCostPerDay || '0',
      mintingCost: data.mintingCost || '0',
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
    if (!game) throw new Error('Game not found or access denied');

    // Get template
    const template = await this.nftTemplateRepo.findOne({
      where: { id: templateId, game: { id: gameId } },
      relations: ['game'],
    });
    if (!template) throw new Error('NFT template not found');

    // Check mint limit
    if (template.maxMintCount && template.currentMintCount >= template.maxMintCount) {
      throw new Error('Max mint count reached for this template');
    }

    // For now, always mint to self (targetUserId is for future use)
    // Later, admin could mint to other players
    // const targetPlayer = targetUserId ? await this.userRepo.findOne({ where: { id: targetUserId } }) : null;

    let gamePlayer = await this.gamePlayerRepo.findOne({
      where: { game: { id: gameId } },
    });

    if (!gamePlayer) {
      throw new Error('No game player found for minting');
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
    const { gamePlayer } = await this.ensureGameWalletForPlayer(gameId, userId, studioId);

    const nftInstance = await this.nftInstanceRepo.findOne({
      where: {
        id: nftId,
        owner: { id: gamePlayer.id },
        template: { game: { id: gameId } },
      },
      relations: ['template', 'owner'],
    });

    if (!nftInstance) throw new AppException(ERROR_MESSAGES.ASSET_NOT_FOUND, 404);

    if (updates.equipped !== undefined) nftInstance.equipped = updates.equipped;
    if (updates.condition !== undefined) nftInstance.condition = Math.max(0, Math.min(100, updates.condition));
    if (updates.customAttributes) nftInstance.customAttributes = { ...nftInstance.customAttributes, ...updates.customAttributes };

    return this.nftInstanceRepo.save(nftInstance);
  }

  // StudioUser Management

  async createPersonalAccount(studioId: string, email: string, password: string, accessPoints?: Record<string, boolean>) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new Error('Studio not found');

    // Check if this is the first personal user - they get admin role
    const existingUsers = await this.studioUserRepo.count({
      where: { studio: { id: studioId } }
    });
    const role = existingUsers === 0 ? StudioUserRole.ADMIN : StudioUserRole.MEMBER;

    // Check if email already exists in this studio
    const existingUser = await this.studioUserRepo.findOne({
      where: { studio: { id: studioId }, email }
    });
    if (existingUser) throw new AppException(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, 409);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Set default access points if not provided
    let defaultAccessPoints = accessPoints || {};
    if (Object.keys(defaultAccessPoints).length === 0) {
      // Default: all false, owner can enable them
      defaultAccessPoints = {};
    }

    const studioUser = this.studioUserRepo.create({
      studio,
      email,
      passwordHash,
      role,
      accessPoints: defaultAccessPoints,
    });

    return this.studioUserRepo.save(studioUser);
  }

  async getStudioUsers(studioId: string) {
    return this.studioUserRepo.find({
      where: { studio: { id: studioId } },
      select: ['id', 'email', 'role', 'accessPoints', 'createdAt', 'updatedAt'],
    });
  }

  async loginStudioUser(studioId: string, email: string, password: string) {
    const studioUser = await this.studioUserRepo.findOne({
      where: { studio: { id: studioId }, email },
    });
    if (!studioUser) throw new AppException(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);

    const isPasswordValid = await bcrypt.compare(password, studioUser.passwordHash);
    if (!isPasswordValid) throw new AppException(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);

    return studioUser;
  }

  async getStudioUserById(studioId: string, userId: string) {
    return this.studioUserRepo.findOne({
      where: { id: userId, studio: { id: studioId } },
    });
  }

  async updatePersonalAccountPermissions(
    studioId: string,
    userId: string,
    accessPoints: Record<string, boolean>,
  ) {
    const studioUser = await this.studioUserRepo.findOne({
      where: { id: userId, studio: { id: studioId } },
    });
    if (!studioUser) throw new AppException(ERROR_MESSAGES.USER_NOT_FOUND, 404);

    studioUser.accessPoints = accessPoints;
    return this.studioUserRepo.save(studioUser);
  }
}
