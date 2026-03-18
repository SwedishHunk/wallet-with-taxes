import { GamePlayer } from "./game-player.entity";
export declare class GameWallet {
    id: string;
    gamePlayer: GamePlayer;
    balance: string;
    totalDeposited: string;
    totalWithdrawn: string;
    createdAt: Date;
    updatedAt: Date;
}
