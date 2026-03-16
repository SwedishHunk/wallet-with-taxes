import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";

type JwtPayload = {
  id: string;
  email: string;
  studioId: string;
  role: "owner" | "admin" | "member";
  isAdmin: boolean;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    // Check suspension on every request so that admin-suspended users are
    // blocked immediately rather than only at next login.
    const user = await this.userRepo.findOne({
      where: { id: payload.id },
      select: ["id", "isSuspended"],
    });

    if (!user || user.isSuspended === true) {
      throw new UnauthorizedException("Account is suspended or does not exist");
    }

    return {
      id: payload.id,
      email: payload.email,
      studioId: payload.studioId,
      role: payload.role,
      isAdmin: payload.isAdmin === true,
    };
  }
}
