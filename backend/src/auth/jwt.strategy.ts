import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { Request } from "express";
import { User } from "../users/user.entity";
import { SuspensionCacheService } from "./suspension-cache.service";

type JwtPayload = {
  id: string;
  email: string;
  walletAddress?: string;
  /** Absent in base JWTs (before studio selection). */
  studioId?: string;
  /** Absent in base JWTs (before studio selection). */
  role?: "owner" | "admin" | "member";
  isAdmin: boolean;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly suspensionCache: SuspensionCacheService,
  ) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }

    super({
      // Primary: HttpOnly cookie (XSS-safe). Fallback: Bearer header
      // (player portal and any non-browser clients that can't use cookies).
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.access_token ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    // Check suspension on every request. The distributed cache (Redis if
    // REDIS_URL is set, in-process Map otherwise) avoids a DB hit on cache
    // hits and ensures suspension propagates across all instances within 5 s.
    let isSuspended = await this.suspensionCache.get(payload.id);

    if (isSuspended === null) {
      // Cache miss — fetch from DB and repopulate
      const user = await this.userRepo.findOne({
        where: { id: payload.id },
        select: ["id", "isSuspended"],
      });
      if (!user) {
        throw new UnauthorizedException("Account does not exist");
      }
      isSuspended = user.isSuspended === true;
      await this.suspensionCache.set(payload.id, isSuspended);
    }

    if (isSuspended) {
      throw new UnauthorizedException("Account is suspended");
    }

    return {
      id: payload.id,
      email: payload.email,
      walletAddress: payload.walletAddress,
      studioId: payload.studioId,
      role: payload.role,
      isAdmin: payload.isAdmin === true,
    };
  }
}
