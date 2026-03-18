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

interface DevBootstrapRequestMeta {
  ip?: string;
  remoteAddress?: string;
}

@Injectable()
export class AdminDevService {
  private static readonly DEFAULT_DEV_STUDIO_NAME = "Dev Studio";
  private static readonly DEFAULT_DEV_GAME_NAME = "Dev Game";
  private static readonly DEFAULT_DEV_GAME_SLUG = "dev-game";

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

  private isLoopbackAddress(value?: string): boolean {
    if (!value) {
      return false;
    }

    const normalized = value.trim().split(",")[0].replace(/^\[|\]$/g, "");
    return (
      normalized === "127.0.0.1" ||
      normalized === "::1" ||
      normalized === "::ffff:127.0.0.1"
    );
  }

  private isLocalDevelopmentRequest(requestMeta?: DevBootstrapRequestMeta): boolean {
    return (
      this.isLoopbackAddress(requestMeta?.ip) ||
      this.isLoopbackAddress(requestMeta?.remoteAddress)
    );
  }

  private assertBootstrapAllowed(
    providedKey?: string,
    requestMeta?: DevBootstrapRequestMeta,
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new AppException("Dev bootstrap is disabled in production", 403);
    }

    const expectedKey =
      process.env.DEV_BOOTSTRAP_KEY || process.env.ADMIN_API_KEY;
    if (!expectedKey) {
      if (this.isLocalDevelopmentRequest(requestMeta)) {
        return;
      }
      throw new AppException("Dev bootstrap key is not configured", 503);
    }

    if (!providedKey || providedKey !== expectedKey) {
      throw new AppException("Invalid dev bootstrap key", 401);
    }
  }

  private async isBootstrapEmailTaken(email: string): Promise<boolean> {
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      return true;
    }
    const existingStudio = await this.studioRepo.findOne({ where: { email } });
    return !!existingStudio;
  }

  private buildEmailCandidate(baseEmail: string, suffix: number): string {
    const atIndex = baseEmail.indexOf("@");
    if (atIndex === -1) {
      return `${baseEmail}+${suffix}`;
    }
    const localPart = baseEmail.slice(0, atIndex);
    const domainPart = baseEmail.slice(atIndex + 1);
    return `${localPart}+${suffix}@${domainPart}`;
  }

  private async resolveBootstrapEmail(
    requestedEmail: string,
    allowFallbackCandidates: boolean,
  ): Promise<string> {
    const trimmedEmail = requestedEmail.trim();
    if (!allowFallbackCandidates) {
      return trimmedEmail;
    }

    if (!(await this.isBootstrapEmailTaken(trimmedEmail))) {
      return trimmedEmail;
    }

    let suffix = 2;
    while (true) {
      const candidate = this.buildEmailCandidate(trimmedEmail, suffix);
      if (!(await this.isBootstrapEmailTaken(candidate))) {
        return candidate;
      }
      suffix += 1;
    }
  }

  private async resolveBootstrapStudioName(
    requestedStudioName: string,
    email: string,
  ): Promise<string> {
    const trimmedStudioName = requestedStudioName.trim();
    const fallbackCandidates = [trimmedStudioName, email];

    for (const candidate of fallbackCandidates) {
      const existingStudio = await this.studioRepo.findOne({
        where: { name: candidate },
      });
      if (!existingStudio) {
        return candidate;
      }
    }

    let suffix = 2;
    while (true) {
      const candidate = `${trimmedStudioName} ${suffix}`;
      const existingStudio = await this.studioRepo.findOne({
        where: { name: candidate },
      });
      if (!existingStudio) {
        return candidate;
      }
      suffix += 1;
    }
  }

  async bootstrap(
    options: DevBootstrapOptions,
    providedKey?: string,
    requestMeta?: DevBootstrapRequestMeta,
  ) {
    this.assertBootstrapAllowed(providedKey, requestMeta);

    const requestedEmail = options.email?.trim() || "dev-owner@triolith.local";
    const allowEmailFallback = !options.email?.trim();
    const password = options.password || "DevPass123!";
    const requestedStudioName =
      options.studioName?.trim() || AdminDevService.DEFAULT_DEV_STUDIO_NAME;
    const gameName =
      options.gameName?.trim() || AdminDevService.DEFAULT_DEV_GAME_NAME;
    const gameSlug =
      options.gameSlug?.trim() || AdminDevService.DEFAULT_DEV_GAME_SLUG;

    let bootstrapEmail = requestedEmail;
    const existingUser = await this.userRepo.findOne({
      where: { email: requestedEmail },
    });

    if (existingUser) {
      try {
        const existingLogin = await this.usersService.login(requestedEmail, password);
        bootstrapEmail = requestedEmail;
        const userId = existingLogin.user.id;
        const studioId = existingLogin.user.studioId;

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
          token: existingLogin.token,
          credentials: {
            email: bootstrapEmail,
            password,
          },
          studio: {
            studioId: studio.id,
            studioName: studio.name,
            isTriolithAdmin: existingLogin.user.isAdmin === true,
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
      } catch (error) {
        if (!allowEmailFallback) {
          throw error;
        }

        bootstrapEmail = await this.resolveBootstrapEmail(
          requestedEmail,
          allowEmailFallback,
        );
      }
    } else {
      bootstrapEmail = await this.resolveBootstrapEmail(
        requestedEmail,
        allowEmailFallback,
      );
    }

    const studioName = await this.resolveBootstrapStudioName(
      requestedStudioName,
      bootstrapEmail,
    );

    try {
      await this.usersService.signup(bootstrapEmail, password, studioName);
    } catch (error) {
      if (!allowEmailFallback) {
        throw error;
      }
      bootstrapEmail = await this.resolveBootstrapEmail(
        this.buildEmailCandidate(bootstrapEmail, 2),
        true,
      );
      const retryStudioName = await this.resolveBootstrapStudioName(
        requestedStudioName,
        bootstrapEmail,
      );
      await this.usersService.signup(bootstrapEmail, password, retryStudioName);
    }

    const loginResult = await this.usersService.login(bootstrapEmail, password);
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
        email: bootstrapEmail,
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
