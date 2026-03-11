import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { ethers } from "ethers";

export type PlayerWalletAuthPurpose = "session" | "economic_event";

type PendingNonce = {
  walletAddress: string;
  purpose: PlayerWalletAuthPurpose;
  gameId: string | null;
  nonce: string;
  message: string;
  expiresAt: number;
};

type SignedPlayerWalletRequest = {
  walletAddress: string;
  nonce: string;
  signature: string;
  purpose: PlayerWalletAuthPurpose;
  gameId?: string | null;
};

@Injectable()
export class PlayerWalletAuthService {
  private readonly nonceTtlMs = 5 * 60 * 1000;
  private readonly pendingNonces = new Map<string, PendingNonce>();

  issueNonce(
    walletAddress: string,
    purpose: PlayerWalletAuthPurpose,
    gameId?: string | null,
  ) {
    const normalizedWallet = this.normalizeWalletAddress(walletAddress);
    const normalizedGameId = gameId?.trim() || null;
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + this.nonceTtlMs;
    const message = this.buildMessage({
      walletAddress: normalizedWallet,
      purpose,
      gameId: normalizedGameId,
      nonce,
    });

    this.pendingNonces.set(this.buildKey(normalizedWallet, purpose, nonce), {
      walletAddress: normalizedWallet,
      purpose,
      gameId: normalizedGameId,
      nonce,
      message,
      expiresAt,
    });

    return {
      walletAddress: normalizedWallet,
      purpose,
      gameId: normalizedGameId,
      nonce,
      message,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  verifySignedRequest(request: SignedPlayerWalletRequest) {
    const normalizedWallet = this.normalizeWalletAddress(request.walletAddress);
    const normalizedGameId = request.gameId?.trim() || null;
    const key = this.buildKey(normalizedWallet, request.purpose, request.nonce);
    const pending = this.pendingNonces.get(key);

    if (!pending) {
      throw new UnauthorizedException(
        "Wallet proof is missing or has already been used",
      );
    }

    if (pending.expiresAt < Date.now()) {
      this.pendingNonces.delete(key);
      throw new UnauthorizedException("Wallet proof has expired");
    }

    if (pending.gameId !== normalizedGameId) {
      this.pendingNonces.delete(key);
      throw new UnauthorizedException("Wallet proof game scope mismatch");
    }

    const recovered = ethers.verifyMessage(pending.message, request.signature);
    if (recovered.toLowerCase() !== normalizedWallet) {
      this.pendingNonces.delete(key);
      throw new UnauthorizedException("Wallet signature could not be verified");
    }

    this.pendingNonces.delete(key);

    return {
      walletAddress: normalizedWallet,
      purpose: request.purpose,
      gameId: normalizedGameId,
    };
  }

  private buildMessage(input: {
    walletAddress: string;
    purpose: PlayerWalletAuthPurpose;
    gameId: string | null;
    nonce: string;
  }) {
    return [
      "Triolith Player Wallet Verification",
      `Wallet: ${input.walletAddress}`,
      `Purpose: ${input.purpose}`,
      `Game: ${input.gameId ?? "global"}`,
      `Nonce: ${input.nonce}`,
    ].join("\n");
  }

  private normalizeWalletAddress(walletAddress: string) {
    const normalized = walletAddress?.trim().toLowerCase();
    if (!normalized || !ethers.isAddress(normalized)) {
      throw new BadRequestException("walletAddress must be a valid EVM address");
    }

    return normalized;
  }

  private buildKey(
    walletAddress: string,
    purpose: PlayerWalletAuthPurpose,
    nonce: string,
  ) {
    return `${walletAddress}:${purpose}:${nonce}`;
  }
}
