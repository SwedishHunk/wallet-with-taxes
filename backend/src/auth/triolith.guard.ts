import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { JwtUser } from "./jwt-user.interface";

/**
 * TriolithGuard — platform-level super-admin only.
 * Requires user.isAdmin === true in the JWT (set from User.isAdmin in the DB).
 * This is completely separate from studio-level AdminGuard.
 */
@Injectable()
export class TriolithGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtUser;
    return user?.isAdmin === true;
  }
}
