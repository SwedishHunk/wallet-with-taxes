import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { PlayerNonce } from "./entities/player-nonce.entity";

export type PlayerWalletAuthPurpose = "session" | "economic_event";

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

  constructor(
    @InjectRepository(PlayerNonce)
    private readonly nonceRepo: Repository<PlayerNonce>,
  ) {}

  async issueNonce(
    walletAddress: string,
    purpose: PlayerWalletAuthPurpose,
    gameId?: string | null,
  ) {
    const normalizedWallet = this.normalizeWalletAddress(walletAddress);
    const normalizedGameId = gameId?.trim() || null;
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + this.nonceTtlMs);
    const message = this.buildMessage({
      walletAddress: normalizedWallet,
      purpose,
      gameId: normalizedGameId,
      nonce,
    });
    const key = this.buildKey(normalizedWallet, purpose, nonce);

    await this.nonceRepo.save(
      this.nonceRepo.create({
        key,
        walletAddress: normalizedWallet,
        purpose,
        gameId: normalizedGameId,
        nonce,
        message,
        expiresAt,
      }),
    );

    // Probabilistic cleanup (~10% of calls) — purge rows that have expired
    if (Math.random() < 0.1) {
      void this.nonceRepo.delete({ expiresAt: LessThan(new Date()) });
    }

    return {
      walletAddress: normalizedWallet,
      purpose,
      gameId: normalizedGameId,
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifySignedRequest(request: SignedPlayerWalletRequest) {
    const normalizedWallet = this.normalizeWalletAddress(request.walletAddress);
    const normalizedGameId = request.gameId?.trim() || null;
    const key = this.buildKey(normalizedWallet, request.purpose, request.nonce);

    const pending = await this.nonceRepo.findOne({ where: { key } });

    if (!pending) {
      throw new UnauthorizedException(
        "Wallet proof is missing or has already been used",
      );
    }

    if (new Date() > pending.expiresAt) {
      await this.nonceRepo.delete(key);
      throw new UnauthorizedException("Wallet proof has expired");
    }

    if (pending.gameId !== normalizedGameId) {
      await this.nonceRepo.delete(key);
      throw new UnauthorizedException("Wallet proof game scope mismatch");
    }

    const recovered = ethers.verifyMessage(pending.message, request.signature);
    if (recovered.toLowerCase() !== normalizedWallet) {
      await this.nonceRepo.delete(key);
      throw new UnauthorizedException("Wallet signature could not be verified");
    }

    // Consume the nonce — one-time use
    await this.nonceRepo.delete(key);

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
      throw new BadRequestException(
        "walletAddress must be a valid EVM address",
      );
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
