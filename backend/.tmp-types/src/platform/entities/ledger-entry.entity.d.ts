import { GameWallet } from "./game-wallet.entity";
export declare class LedgerEntry {
    id: string;
    wallet: GameWallet;
    txGroupId: string;
    type: "deposit" | "withdraw" | "spend" | "earn" | "transfer" | "upkeep" | "mint";
    amount: string;
    counterpartyUserId?: string;
    intentId?: string | null;
    description?: string;
    txHash?: string;
    createdAt: Date;
}
