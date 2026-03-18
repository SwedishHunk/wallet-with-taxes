import { AdminDevService } from "./admin-dev.service";
interface DevBootstrapBody {
    email?: string;
    password?: string;
    studioName?: string;
    gameName?: string;
    gameSlug?: string;
}
export declare class AdminDevController {
    private readonly adminDevService;
    constructor(adminDevService: AdminDevService);
    bootstrap(body: DevBootstrapBody, devBootstrapKey?: string): Promise<{
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
