import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppException } from "../common/exceptions/app-exception";
import { PlatformService } from "../platform/platform.service";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import { User } from "../users/user.entity";
import { UsersService } from "../users/users.service";

interface DevBootstrapOptions {
  email?: string;
  password?: string;
  studioName?: string;
  gameName?: string;
  gameSlug?: string;
}

@Injectable()
export class AdminDevService {
  constructor(
    private readonly usersService: UsersService,
    private readonly platformService: PlatformService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Studio)
    private readonly studioRepo: Repository<Studio>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
  ) {}

  private assertBootstrapAllowed(providedKey?: string) {
    if (process.env.NODE_ENV === "production") {
      throw new AppException("Dev bootstrap is disabled in production", 403);
    }

    const expectedKey =
      process.env.DEV_BOOTSTRAP_KEY || process.env.ADMIN_API_KEY;
    if (expectedKey && providedKey && providedKey !== expectedKey) {
      throw new AppException("Invalid dev bootstrap key", 401);
    }
  }

  async bootstrap(options: DevBootstrapOptions, providedKey?: string) {
    this.assertBootstrapAllowed(providedKey);

    const email = options.email?.trim() || "dev-owner@triolith.local";
    const password = options.password || "DevPass123!";
    const studioName = options.studioName?.trim() || "Dev Studio";
    const gameName = options.gameName?.trim() || "Dev Game";
    const gameSlug = options.gameSlug?.trim() || "dev-game";

    const existingUser = await this.userRepo.findOne({ where: { email } });

    if (!existingUser) {
      await this.usersService.signup(email, password, studioName);
    }

    const loginResult = await this.usersService.login(email, password);
    const userId = loginResult.user.id;
    const studioId = loginResult.user.studioId;

    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new AppException("Studio not found after bootstrap login", 404);
    }

    let game =
      (await this.gameRepo.findOne({
        where: { studio: { id: studioId }, slug: gameSlug },
      })) ||
      (await this.gameRepo.findOne({
        where: { studio: { id: studioId }, name: gameName },
      }));

    if (!game) {
      game = await this.platformService.createGameForUser(userId, studioId, {
        name: gameName,
        slug: gameSlug,
      });
    }

    const member = await this.usersService.getMemberSession(userId, studioId);

    return {
      token: loginResult.token,
      credentials: {
        email,
        password,
      },
      studio: {
        studioId: studio.id,
        studioName: studio.name,
        isTriolithAdmin: loginResult.user.isAdmin === true,
      },
      member,
      game: {
        gameId: game.id,
        name: game.name,
        slug: game.slug,
      },
      routes: {
        dashboard: "/dashboard",
        games: "/games",
        trade: `/player/game/${game.id}/trade`,
      },
    };
  }
}
