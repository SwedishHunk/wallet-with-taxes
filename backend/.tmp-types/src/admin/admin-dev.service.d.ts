import { Repository } from "typeorm";
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
export declare class AdminDevService {
    private readonly usersService;
    private readonly platformService;
    private readonly userRepo;
    private readonly studioRepo;
    private readonly gameRepo;
    constructor(usersService: UsersService, platformService: PlatformService, userRepo: Repository<User>, studioRepo: Repository<Studio>, gameRepo: Repository<Game>);
    private assertBootstrapAllowed;
    bootstrap(options: DevBootstrapOptions, providedKey?: string): Promise<{
        token: string;
        credentials: {
            email: string;
            password: string;
        };
        studio: {
            studioId: string;
            studioName: string;
            isTriolithAdmin: boolean;
        };
        member: {
            memberId: string;
            userId: string;
            studioId: string;
            email: string;
            isOwner: boolean;
            role: import("../platform/entities/studio-member.entity").StudioRole;
            permissions: string[];
            gameAccessIds: string[];
        };
        game: {
            gameId: string;
            name: string;
            slug: string;
        };
        routes: {
            dashboard: string;
            games: string;
            trade: string;
        };
    }>;
}
export {};
