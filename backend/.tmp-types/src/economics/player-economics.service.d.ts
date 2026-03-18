import { Repository } from "typeorm";
import { Game } from "../platform/entities/game.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { User } from "../users/user.entity";
import { EconomicDirection, EconomicScopeType } from "./entities/economic-event.entity";
import { EconomicsService } from "./economics.service";
type LogGameScopedEventInput = {
    gameId: string;
    walletAddress: string;
    txHash?: string;
    eventType: string;
    assetKey: string;
    assetSymbol?: string;
    amount: string;
    direction: EconomicDirection;
    metadata?: Record<string, unknown>;
};
export declare class PlayerEconomicsService {
    private readonly gameRepo;
    private readonly gamePlayerRepo;
    private readonly userRepo;
    private readonly economicsService;
    private readonly logger;
    constructor(gameRepo: Repository<Game>, gamePlayerRepo: Repository<GamePlayer>, userRepo: Repository<User>, economicsService: EconomicsService);
    resolveSession(gameId: string, walletAddress: string): Promise<{
        studioId: string;
        studioName: string;
        gameId: string;
        gameName: string;
        gamePlayerId: string;
        userId: string;
        walletAddress: string;
        scopeType: EconomicScopeType;
    }>;
    logGameScopedEvent(input: LogGameScopedEventInput): Promise<import("./entities/economic-event.entity").EconomicEvent>;
    private findOrCreateWalletUser;
    private findOrCreateGamePlayer;
}
export {};
