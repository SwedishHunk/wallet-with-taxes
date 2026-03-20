import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Studio } from "./entities/studio.entity";
import { StudioMember } from "./entities/studio-member.entity";
import { StudioUser } from "./entities/studio-user.entity";
import { Game } from "./entities/game.entity";
import { GamePlayer } from "./entities/game-player.entity";
import { GameWallet } from "./entities/game-wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { NFTTemplate } from "./entities/nft-template.entity";
import { NFTInstance } from "./entities/nft-instance.entity";
import { WalletDepositIntent } from "./entities/wallet-deposit-intent.entity";
import { MarketplaceListing } from "./entities/marketplace-listing.entity";
import { PlayerWalletIdentity } from "./entities/player-wallet-identity.entity";
import { PlatformService } from "./platform.service";
import { PlayerWalletIdentityService } from "./player-wallet-identity.service";
import { MarketplaceService } from "./marketplace.service";
import { PlayerWalletOperationsService } from "./player-wallet-operations.service";
import {
  ApiPlatformController,
  PlatformController,
} from "./platform.controller";
import { StudiosController } from "./studios.controller";
import { StudioMemberService } from "./studio-member.service";
import { StudiosService } from "./studios.service";
import { User } from "../users/user.entity";
import { EconomicsModule } from "../economics/economics.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Studio,
      StudioMember,
      StudioUser,
      Game,
      GamePlayer,
      GameWallet,
      LedgerEntry,
      NFTTemplate,
      NFTInstance,
      WalletDepositIntent,
      MarketplaceListing,
      PlayerWalletIdentity,
      User,
    ]),
    EconomicsModule,
  ],
  controllers: [PlatformController, ApiPlatformController, StudiosController],
  providers: [
    PlatformService,
    PlayerWalletIdentityService,
    MarketplaceService,
    PlayerWalletOperationsService,
    StudioMemberService,
    StudiosService,
  ],
  exports: [
    TypeOrmModule,
    PlatformService,
    PlayerWalletIdentityService,
    MarketplaceService,
    PlayerWalletOperationsService,
    StudioMemberService,
    StudiosService,
  ],
})
export class PlatformModule {}
