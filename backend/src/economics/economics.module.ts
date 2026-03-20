import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Game } from "../platform/entities/game.entity";
import { GamePlayer } from "../platform/entities/game-player.entity";
import { PlayerWalletIdentity } from "../platform/entities/player-wallet-identity.entity";
import { User } from "../users/user.entity";
import { EconomicsController } from "./economics.controller";
import { EconomicEvent } from "./entities/economic-event.entity";
import { PlayerNonce } from "./entities/player-nonce.entity";
import { EconomicsService } from "./economics.service";
import { PlayerEconomicsService } from "./player-economics.service";
import { PlayerWalletAuthService } from "./player-wallet-auth.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EconomicEvent,
      Game,
      GamePlayer,
      PlayerWalletIdentity,
      User,
      PlayerNonce,
    ]),
  ],
  controllers: [EconomicsController],
  providers: [
    EconomicsService,
    PlayerEconomicsService,
    PlayerWalletAuthService,
  ],
  exports: [EconomicsService, PlayerWalletAuthService, TypeOrmModule],
})
export class EconomicsModule {}
