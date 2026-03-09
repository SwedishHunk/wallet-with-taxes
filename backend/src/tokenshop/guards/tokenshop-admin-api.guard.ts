import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TokenShopAdminApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const headerKey = request.headers["x-admin-key"];
    const expectedKey =
      this.configService.get<string>("TOKENSHOP_ADMIN_API_KEY") ??
      this.configService.get<string>("ADMIN_API_KEY");

    if (!expectedKey || headerKey !== expectedKey) {
      throw new UnauthorizedException("Invalid admin API key");
    }

    return true;
  }
}
