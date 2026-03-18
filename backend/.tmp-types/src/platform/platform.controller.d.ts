import { PlatformService } from "./platform.service";
import { Request } from "express";
import { CreateGameDto, CreateNftTemplateDto, CreatePersonalAccountDto, LoginPersonalAccountDto, TransferBetweenPlayersDto, UpdateNftDto, UpdatePersonalAccountPermissionsDto, WalletAmountDto } from "./dto/platform-request.dto";
import { WalletDepositConfirmDto, WalletDepositIntentDto } from "./dto/wallet-deposit.dto";
export declare class PlatformController {
    private platformService;
    constructor(platformService: PlatformService);
    createGame(req: Request, data: CreateGameDto): Promise<import("./entities/game.entity").Game>;
    getGameWallet(req: Request, gameId: string): Promise<import("./entities/game-wallet.entity").GameWallet>;
    getGameWalletLedger(req: Request, gameId: string): Promise<import("./entities/ledger-entry.entity").LedgerEntry[]>;
    getGameDetails(req: Request, gameId: string): Promise<import("./entities/game.entity").Game>;
    getGames(req: Request): Promise<import("./entities/game.entity").Game[]>;
    depositToWallet(req: Request, gameId: string, data: WalletAmountDto): Promise<import("./entities/game-wallet.entity").GameWallet>;
    createDepositIntent(req: Request, gameId: string, data: WalletDepositIntentDto): Promise<{
        intentId: string;
        depositAddress: string;
        amount: string;
        expiresAt: string;
    }>;
    confirmDepositIntent(req: Request, gameId: string, data: WalletDepositConfirmDto): Promise<import("./entities/game-wallet.entity").GameWallet>;
    withdrawFromWallet(req: Request, gameId: string, data: WalletAmountDto): Promise<import("./entities/game-wallet.entity").GameWallet>;
    transferToPlayer(req: Request, gameId: string, data: TransferBetweenPlayersDto): Promise<{
        fromWallet: import("./entities/game-wallet.entity").GameWallet;
        toWallet: import("./entities/game-wallet.entity").GameWallet;
    }>;
    getNFTTemplates(req: Request, gameId: string): Promise<import("./entities/nft-template.entity").NFTTemplate[]>;
    createNFTTemplate(req: Request, gameId: string, data: CreateNftTemplateDto): Promise<import("./entities/nft-template.entity").NFTTemplate>;
    getPlayerNFTs(req: Request, gameId: string): Promise<import("./entities/nft-instance.entity").NFTInstance[]>;
    mintNFT(req: Request, gameId: string, templateId: string): Promise<import("./entities/nft-instance.entity").NFTInstance>;
    updateNFT(req: Request, gameId: string, nftId: string, data: UpdateNftDto): Promise<import("./entities/nft-instance.entity").NFTInstance>;
    createPersonalAccount(req: Request, data: CreatePersonalAccountDto): never;
    getPersonalAccounts(req: Request): never;
    loginPersonalAccount(req: Request, data: LoginPersonalAccountDto): never;
    updatePersonalAccountPermissions(req: Request, userId: string, data: UpdatePersonalAccountPermissionsDto): never;
}
export declare class ApiPlatformController {
    private platformService;
    constructor(platformService: PlatformService);
    getPublicGames(): Promise<import("./entities/game.entity").Game[]>;
}
