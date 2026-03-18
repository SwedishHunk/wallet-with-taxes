import { Game } from "./game.entity";
export declare class NFTTemplate {
    id: string;
    game: Game;
    name: string;
    tier: number;
    attributes: Record<string, any>;
    upkeepCostPerDay: string;
    mintingCost: string;
    maxMintCount?: number;
    currentMintCount: number;
    createdAt: Date;
    updatedAt: Date;
}
