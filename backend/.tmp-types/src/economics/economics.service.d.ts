import { Repository } from "typeorm";
import { EconomicDirection, EconomicEvent, EconomicScopeType } from "./entities/economic-event.entity";
export type LogEconomicEventInput = {
    source: string;
    eventType: string;
    scopeType: EconomicScopeType;
    studioId?: string | null;
    gameId?: string | null;
    userId?: string | null;
    gamePlayerId?: string | null;
    walletAddress?: string | null;
    assetKey: string;
    assetSymbol?: string | null;
    amount: string;
    direction: EconomicDirection;
    txHash?: string | null;
    metadata?: Record<string, unknown> | null;
    timestamp?: Date;
};
export declare class EconomicsService {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<EconomicEvent>);
    logEvent(input: LogEconomicEventInput): Promise<EconomicEvent>;
    getEventsForStudio(studioId: string, gameId?: string): Promise<EconomicEvent[]>;
    getEventsForStudioGame(studioId: string, gameId: string): Promise<EconomicEvent[]>;
    getEventsForGame(gameId: string): Promise<EconomicEvent[]>;
    getEventsForWallet(walletAddress: string): Promise<EconomicEvent[]>;
    private assertValidScope;
}
