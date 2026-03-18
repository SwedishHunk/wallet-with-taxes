import { User } from "../../users/user.entity";
import { Game } from "./game.entity";
import { StudioUser } from "./studio-user.entity";
export declare class GamePlayer {
    id: string;
    user?: User;
    studioUser?: StudioUser;
    game: Game;
    level: number;
    exp: number;
    joinedAt: Date;
    updatedAt: Date;
}
