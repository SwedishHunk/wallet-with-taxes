import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";

type JwtPayload = {
  id: string;
  email: string;
  walletAddress?: string;
  studioId: string;
  role: "owner" | "admin" | "member";
  isAdmin: boolean;
};

// Per-process suspension cache: reduces one DB query → zero on cache hit.
// TTL of 60 s means a newly suspended user is blocked within 1 minute —
// acceptable for most operational scenarios. For immediate propagation
// (e.g. security incident), a shared Redis cache would be needed.
type SuspensionEntry = { suspended: boolean; expiresAt: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly suspensionCache = new Map<string, SuspensionEntry>();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    // Check suspension on every request so admin-suspended users are blocked
    // quickly. The in-process cache avoids one DB round-trip per request;
    // entries expire after 60 s so suspension takes effect within 1 minute.
    const now = Date.now();
    const cached = this.suspensionCache.get(payload.id);

    let isSuspended: boolean;
    if (cached && cached.expiresAt > now) {
      isSuspended = cached.suspended;
    } else {
      const user = await this.userRepo.findOne({
        where: { id: payload.id },
        select: ["id", "isSuspended"],
      });
      if (!user) {
        throw new UnauthorizedException("Account does not exist");
      }
      isSuspended = user.isSuspended === true;
      this.suspensionCache.set(payload.id, {
        suspended: isSuspended,
        expiresAt: now + this.CACHE_TTL_MS,
      });
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
