import { Studio } from "./studio.entity";
import { GamePlayer } from "./game-player.entity";
export declare enum StudioUserRole {
    ADMIN = "admin",
    MEMBER = "member"
}
export declare class StudioUser {
    id: string;
    studio: Studio;
    email: string;
    passwordHash: string;
    role: StudioUserRole;
    accessPoints: Record<string, boolean>;
    gamePlayers: GamePlayer[];
    createdAt: Date;
    updatedAt: Date;
}
