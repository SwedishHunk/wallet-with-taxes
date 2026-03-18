export declare enum EconomicScopeType {
    GLOBAL = "global",
    STUDIO = "studio",
    GAME = "game"
}
export declare enum EconomicDirection {
    IN = "in",
    OUT = "out",
    NEUTRAL = "neutral"
}
export declare class EconomicEvent {
    id: string;
    source: string;
    eventType: string;
    scopeType: EconomicScopeType;
    studioId: string | null;
    gameId: string | null;
    userId: string | null;
    gamePlayerId: string | null;
    walletAddress: string | null;
    assetKey: string;
    assetSymbol: string | null;
    amount: string;
    direction: EconomicDirection;
    txHash: string | null;
    metadata: Record<string, unknown> | null;
    timestamp: Date;
    createdAt: Date;
}
