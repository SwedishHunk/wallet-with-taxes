import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";

interface JwtUserPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtUserPayload;

    return user?.isAdmin === true;
  }
}
