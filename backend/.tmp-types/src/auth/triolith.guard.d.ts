import { CanActivate, ExecutionContext } from "@nestjs/common";
export declare class TriolithGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
