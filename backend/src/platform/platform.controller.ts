import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  ForbiddenException,
} from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Request } from "express";
import { JwtUser } from "../auth/jwt-user.interface";
import { PlayerWalletAuthService } from "../economics/player-wallet-auth.service";
import {
  CreateGameDto,
  CreateNftTemplateDto,
  CreatePersonalAccountDto,
  LoginPersonalAccountDto,
  TransferBetweenPlayersDto,
  UpdateNftDto,
  UpdatePersonalAccountPermissionsDto,
  WalletAmountDto,
} from "./dto/platform-request.dto";
import {
  WalletDepositConfirmDto,
  WalletDepositIntentDto,
} from "./dto/wallet-deposit.dto";

@Controller("platform")
export class PlatformController {
  constructor(private platformService: PlatformService) {}

  @UseGuards(JwtAuthGuard)
  @Post("games")
  createGame(@Req() req: Request, @Body() data: CreateGameDto) {
    const jwtUser = req.user as JwtUser;
    // Only owner/admin can create games
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can create games");
    }
    return this.platformService.createGameForUser(
      jwtUser.id,
      jwtUser.studioId,
      data,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/wallet")
  getGameWallet(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getGameWalletBalance(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/wallet/ledger")
  getGameWalletLedger(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getGameWalletLedger(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId")
  getGameDetails(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getGameById(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games")
  getGames(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getGamesForUser(jwtUser.studioId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/wallet/deposit")
  depositToWallet(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: WalletAmountDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.depositToGameWallet(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
      data.amount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/wallet/deposit-intent")
  createDepositIntent(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: WalletDepositIntentDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.createWalletDepositIntent(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
      data.amount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/wallet/deposit-confirm")
  confirmDepositIntent(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: WalletDepositConfirmDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.confirmWalletDepositIntent(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
      data.intentId,
      data.txHash,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/wallet/withdraw")
  withdrawFromWallet(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: WalletAmountDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.withdrawFromGameWallet(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
      data.amount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/wallet/transfer")
  transferToPlayer(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: TransferBetweenPlayersDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.transferBetweenPlayersInGame(
      gameId,
      jwtUser.id,
      data.toUserId,
      jwtUser.studioId,
      data.amount,
      data.description,
    );
  }

  // NFT Endpoints

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/nft-templates")
  getNFTTemplates(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getNFTTemplatesForGame(
      gameId,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/nft-templates")
  createNFTTemplate(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() data: CreateNftTemplateDto,
  ) {
    const jwtUser = req.user as JwtUser;
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can create NFT templates");
    }
    return this.platformService.createNFTTemplate(
      gameId,
      jwtUser.studioId,
      data,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/my-nfts")
  getPlayerNFTs(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getPlayerNFTs(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/nft-templates/:templateId/mint")
  mintNFT(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Param("templateId") templateId: string,
    @Body() body: { gamePlayerId?: string },
  ) {
    const jwtUser = req.user as JwtUser;
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can mint NFTs");
    }
    return this.platformService.mintNFTToPlayer(
      gameId,
      jwtUser.studioId,
      templateId,
      body.gamePlayerId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/players")
  registerPlayer(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body() body: { walletAddress: string },
  ) {
    const jwtUser = req.user as JwtUser;
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can register players");
    }
    if (!body?.walletAddress) {
      throw new BadRequestException("walletAddress is required");
    }
    return this.platformService.registerPlayerByWallet(
      gameId,
      body.walletAddress,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/players")
  getGamePlayers(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can view player list");
    }
    return this.platformService.getGamePlayers(gameId, jwtUser.studioId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("games/:gameId/nft-instances")
  getNFTInstances(@Req() req: Request, @Param("gameId") gameId: string) {
    const jwtUser = req.user as JwtUser;
    if (jwtUser.role !== "owner" && jwtUser.role !== "admin") {
      throw new ForbiddenException("Only admins can view all NFT instances");
    }
    return this.platformService.getAllNFTInstancesForGame(
      gameId,
      jwtUser.studioId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("games/:gameId/nfts/:nftId/update")
  updateNFT(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Param("nftId") nftId: string,
    @Body() data: UpdateNftDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.updateNFTInstance(
      gameId,
      jwtUser.id,
      jwtUser.studioId,
      nftId,
      data,
    );
  }

  // Personal Account Management

  @UseGuards(JwtAuthGuard)
  @Post("personal-accounts")
  createPersonalAccount(
    @Req() req: Request,
    @Body() data: CreatePersonalAccountDto,
  ) {
    const jwtUser = req.user as JwtUser;
    // Only studio owners can create personal accounts
    if (jwtUser.role !== "owner") {
      throw new ForbiddenException(
        "Only studio owners can create personal accounts",
      );
    }
    return this.platformService.createPersonalAccount(
      jwtUser.studioId,
      data.email,
      data.password,
      data.accessPoints,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("personal-accounts")
  getPersonalAccounts(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.getStudioUsers(jwtUser.studioId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("personal-accounts/login")
  loginPersonalAccount(
    @Req() req: Request,
    @Body() data: LoginPersonalAccountDto,
  ) {
    const jwtUser = req.user as JwtUser;
    return this.platformService.loginStudioUser(
      jwtUser.studioId,
      data.email,
      data.password,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("personal-accounts/:userId/permissions")
  updatePersonalAccountPermissions(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Body() data: UpdatePersonalAccountPermissionsDto,
  ) {
    const jwtUser = req.user as JwtUser;
    // Only studio owners can update permissions
    if (jwtUser.role !== "owner") {
      throw new ForbiddenException("Only studio owners can update permissions");
    }
    return this.platformService.updatePersonalAccountPermissions(
      jwtUser.studioId,
      userId,
      data.accessPoints,
    );
  }
}

/**
 * Public endpoints under /api/platform/... for the player frontend.
 * The player useApi hook prepends /api (proxied to the backend), so these
 * routes must live under the api/platform prefix.
 */
@Controller("api/platform")
export class ApiPlatformController {
  constructor(
    private platformService: PlatformService,
    private playerWalletAuthService: PlayerWalletAuthService,
  ) {}

  @Get("public-games")
  getPublicGames() {
    return this.platformService.getPublicGameList();
  }

  @Get("player/nfts")
  getPlayerNFTs(@Query("address") address: string) {
    if (!address) return [];
    return this.platformService.getAllNFTsForWallet(address);
  }

  // ─── Player game-wallet operations (wallet-auth) ────────────────────────────

  @Get("player/wallet")
  getPlayerWallet(
    @Query("gameId") gameId: string,
    @Query("address") address: string,
  ) {
    if (!gameId || !address) return null;
    return this.platformService.getPlayerGameWallet(gameId, address);
  }

  @Post("player/withdraw")
  async playerWithdraw(
    @Body()
    body: {
      gameId: string;
      walletAddress: string;
      nonce: string;
      signature: string;
      amount: number;
    },
  ) {
    if (
      !body?.gameId ||
      !body?.walletAddress ||
      !body?.nonce ||
      !body?.signature ||
      !body?.amount
    ) {
      throw new BadRequestException(
        "gameId, walletAddress, nonce, signature, and amount are required",
      );
    }

    await this.playerWalletAuthService.verifySignedRequest({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      signature: body.signature,
      purpose: "player_action",
      gameId: body.gameId,
    });

    return this.platformService.playerWithdrawFromGameWallet(
      body.gameId,
      body.walletAddress,
      body.amount,
    );
  }

  @Post("player/transfer")
  async playerTransfer(
    @Body()
    body: {
      gameId: string;
      walletAddress: string;
      nonce: string;
      signature: string;
      toWalletAddress: string;
      amount: number;
    },
  ) {
    if (
      !body?.gameId ||
      !body?.walletAddress ||
      !body?.nonce ||
      !body?.signature ||
      !body?.toWalletAddress ||
      !body?.amount
    ) {
      throw new BadRequestException(
        "gameId, walletAddress, nonce, signature, toWalletAddress, and amount are required",
      );
    }

    await this.playerWalletAuthService.verifySignedRequest({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      signature: body.signature,
      purpose: "player_action",
      gameId: body.gameId,
    });

    return this.platformService.playerTransferBetweenPlayers(
      body.gameId,
      body.walletAddress,
      body.toWalletAddress,
      body.amount,
    );
  }

  // ─── NFT Shop ────────────────────────────────────────────────────────────────

  @Get("games/:gameId/nft-shop")
  getNFTShop(@Param("gameId") gameId: string) {
    return this.platformService.getNFTShopTemplates(gameId);
  }

  @Post("games/:gameId/nft-shop/:templateId/buy")
  async purchaseNFT(
    @Param("gameId") gameId: string,
    @Param("templateId") templateId: string,
    @Body()
    body: {
      walletAddress: string;
      nonce: string;
      signature: string;
    },
  ) {
    if (!body?.walletAddress || !body?.nonce || !body?.signature) {
      throw new BadRequestException(
        "walletAddress, nonce, and signature are required",
      );
    }

    await this.playerWalletAuthService.verifySignedRequest({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      signature: body.signature,
      purpose: "player_action",
      gameId,
    });

    return this.platformService.purchaseNFTFromShop(
      gameId,
      body.walletAddress,
      templateId,
    );
  }
}
