import { Repository } from "typeorm";
import { PlayerNonce } from "./entities/player-nonce.entity";
export type PlayerWalletAuthPurpose = "session" | "economic_event";
type SignedPlayerWalletRequest = {
    walletAddress: string;
    nonce: string;
    signature: string;
    purpose: PlayerWalletAuthPurpose;
    gameId?: string | null;
};
export declare class PlayerWalletAuthService {
    private readonly nonceRepo;
    private readonly nonceTtlMs;
    constructor(nonceRepo: Repository<PlayerNonce>);
    issueNonce(walletAddress: string, purpose: PlayerWalletAuthPurpose, gameId?: string | null): Promise<{
        walletAddress: string;
        purpose: PlayerWalletAuthPurpose;
        gameId: string | null;
        nonce: string;
        message: string;
        expiresAt: string;
    }>;
    verifySignedRequest(request: SignedPlayerWalletRequest): Promise<{
        walletAddress: string;
        purpose: PlayerWalletAuthPurpose;
        gameId: string | null;
    }>;
    private buildMessage;
    private normalizeWalletAddress;
    private buildKey;
}
export {};
