import { Game } from "./game.entity";
import { User } from "../../users/user.entity";
export declare enum WalletDepositIntentStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    EXPIRED = "EXPIRED"
}
export declare class WalletDepositIntent {
    id: string;
    game: Game;
    user: User;
    amount: string;
    depositAddress: string;
    status: WalletDepositIntentStatus;
    txHash?: string;
    expiresAt: Date;
    confirmedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
