import { Request } from "express";
import { EconomicsService } from "./economics.service";
import { PlayerEconomicsService } from "./player-economics.service";
import { EconomicDirection } from "./entities/economic-event.entity";
import { PlayerWalletAuthPurpose, PlayerWalletAuthService } from "./player-wallet-auth.service";
type PlayerSessionBody = {
    gameId: string;
    walletAddress: string;
    nonce: string;
    signature: string;
};
type LogPlayerEventBody = {
    gameId: string;
    walletAddress: string;
    nonce: string;
    signature: string;
    txHash?: string;
    eventType: string;
    assetKey: string;
    assetSymbol?: string;
    amount: string;
    direction: EconomicDirection;
    metadata?: Record<string, unknown>;
};
export declare class EconomicsController {
    private readonly economicsService;
    private readonly playerEconomicsService;
    private readonly playerWalletAuthService;
    private readonly logger;
    constructor(economicsService: EconomicsService, playerEconomicsService: PlayerEconomicsService, playerWalletAuthService: PlayerWalletAuthService);
    getPlayerNonce(walletAddress?: string, purpose?: PlayerWalletAuthPurpose, gameId?: string): Promise<{
        walletAddress: string;
        purpose: PlayerWalletAuthPurpose;
        gameId: string | null;
        nonce: string;
        message: string;
        expiresAt: string;
    }>;
    createOrLoadPlayerSession(body?: PlayerSessionBody): Promise<{
        studioId: string;
        studioName: string;
        gameId: string;
        gameName: string;
        gamePlayerId: string;
        userId: string;
        walletAddress: string;
        scopeType: import("./entities/economic-event.entity").EconomicScopeType;
    }>;
    logGameScopedPlayerEvent(body?: LogPlayerEventBody): Promise<import("./entities/economic-event.entity").EconomicEvent>;
    getEventsForCurrentStudio(req: Request, gameId?: string): Promise<import("./entities/economic-event.entity").EconomicEvent[]>;
    getEventsForCurrentStudioGame(req: Request, gameId: string): Promise<import("./entities/economic-event.entity").EconomicEvent[]>;
}
export {};
