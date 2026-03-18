import { DataSource, Repository } from "typeorm";
import { Studio } from "./entities/studio.entity";
import { StudioMember, StudioRole } from "./entities/studio-member.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { WalletDepositIntent } from "./entities/wallet-deposit-intent.entity";
import { User } from "../users/user.entity";
export declare class PlatformService {
    private dataSource;
    private studioRepo;
    private studioMemberRepo;
    private gameRepo;
    private gamePlayerRepo;
    private walletRepo;
    private ledgerRepo;
    private nftTemplateRepo;
    private nftInstanceRepo;
    private walletDepositIntentRepo;
    private userRepo;
    private static readonly DEPOSIT_INTENT_TTL_MS;
    private static readonly UNVERIFIED_WALLET_DEPOSITS_DISABLED_MESSAGE;
    private buildStudioScopedSlug;
    constructor(dataSource: DataSource, studioRepo: Repository<Studio>, studioMemberRepo: Repository<StudioMember>, gameRepo: Repository<Game>, gamePlayerRepo: Repository<GamePlayer>, walletRepo: Repository<GameWallet>, ledgerRepo: Repository<LedgerEntry>, nftTemplateRepo: Repository<NFTTemplate>, nftInstanceRepo: Repository<NFTInstance>, walletDepositIntentRepo: Repository<WalletDepositIntent>, userRepo: Repository<User>);
    private assertUnverifiedWalletDepositsEnabled;
    private generateFakeDepositAddress;
    private isValidFakeTxHash;
    private findUserOrThrow;
    private ensureGamePlayer;
    private ensureWalletForGamePlayer;
    private lockWalletOrThrow;
    private assertGameBelongsToStudio;
    ensureStudioForUser(userId: string): Promise<Studio>;
    getStudiosForUser(userId: string): Promise<Studio[]>;
    getStudioWithRoleForUser(studioId: string, userId: string): Promise<{
        studio: Studio;
        role: StudioRole;
    }>;
    createGameForUser(userId: string, studioId: string, data: {
        name: string;
        slug: string;
    }): Promise<Game>;
    getGamesForUser(studioId: string): Promise<Game[]>;
    getPublicGameList(): Promise<Game[]>;
    getGameById(gameId: string, userId: string, studioId: string): Promise<Game>;
    ensureGameWalletForPlayer(gameId: string, userId: string, studioId: string): Promise<{
        gamePlayer: GamePlayer;
        wallet: GameWallet;
    }>;
    getGameWalletBalance(gameId: string, userId: string, studioId: string): Promise<GameWallet>;
    getGameWalletLedger(gameId: string, userId: string, studioId: string): Promise<LedgerEntry[]>;
    depositToGameWallet(gameId: string, userId: string, studioId: string, amount: unknown, description?: string): Promise<GameWallet>;
    createWalletDepositIntent(gameId: string, userId: string, studioId: string, amount: unknown): Promise<{
        intentId: string;
        depositAddress: string;
        amount: string;
        expiresAt: string;
    }>;
    confirmWalletDepositIntent(gameId: string, userId: string, studioId: string, intentId: string, txHash: string): Promise<GameWallet>;
    withdrawFromGameWallet(gameId: string, userId: string, studioId: string, amount: unknown, description?: string): Promise<GameWallet>;
    transferBetweenPlayersInGame(gameId: string, fromUserId: string, toUserId: string, studioId: string, amount: unknown, description?: string): Promise<{
        fromWallet: GameWallet;
        toWallet: GameWallet;
    }>;
    getNFTTemplatesForGame(gameId: string, studioId: string): Promise<NFTTemplate[]>;
    getPlayerNFTs(gameId: string, userId: string, studioId: string): Promise<NFTInstance[]>;
    createNFTTemplate(gameId: string, studioId: string, data: {
        name: string;
        tier?: number;
        attributes?: Record<string, any>;
        upkeepCostPerDay?: string;
        mintingCost?: string;
        maxMintCount?: number;
    }): Promise<NFTTemplate>;
    mintNFTToPlayer(gameId: string, studioId: string, templateId: string): Promise<NFTInstance>;
    updateNFTInstance(gameId: string, userId: string, studioId: string, nftId: string, updates: {
        equipped?: boolean;
        condition?: number;
        customAttributes?: Record<string, any>;
    }): Promise<NFTInstance>;
    createPersonalAccount(studioId: string, email: string, password: string, accessPoints?: Record<string, boolean>): never;
    getStudioUsers(studioId: string): never;
    loginStudioUser(studioId: string, email: string, password: string): never;
    updatePersonalAccountPermissions(studioId: string, userId: string, accessPoints: Record<string, boolean>): never;
}
