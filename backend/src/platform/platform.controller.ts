import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  ForbiddenException,
} from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Request } from "express";
import { JwtUser } from "../auth/jwt-user.interface";
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
  constructor(private platformService: PlatformService) {}

  @Get("public-games")
  getPublicGames() {
    return this.platformService.getPublicGameList();
  }
}
