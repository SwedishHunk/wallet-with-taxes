import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";

type JwtPayload = {
  id: string;
  email: string;
  studioId: string;
  role: "owner" | "admin" | "member";
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "default_jwt_secret", // fallback for safety
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: JwtPayload) {
    return {
      id: payload.id,
      email: payload.email,
      studioId: payload.studioId,
      role: payload.role,
    };
  }
}
