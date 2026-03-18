import { Strategy } from "passport-jwt";
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
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly userRepo;
    private readonly suspensionCache;
    private readonly CACHE_TTL_MS;
    constructor(userRepo: Repository<User>);
    validate(payload: JwtPayload): Promise<{
        id: string;
        email: string;
        walletAddress: string | undefined;
        studioId: string;
        role: "admin" | "member" | "owner";
        isAdmin: boolean;
    }>;
}
export {};
