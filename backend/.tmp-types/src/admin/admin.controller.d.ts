import { AdminService } from "../admin/admin.service";
import { SetStudioStatusDto, SetUserAdminDto, SetUserSuspendedDto, SetPlatformFeeDto, SetGameStatusDto } from "./dto/admin-request.dto";
interface AuthRequest {
    user: {
        id: string;
        email: string;
    };
}
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getFeeStats(from?: string, to?: string): Promise<{
        totalFeesUSD: number;
        totalTrades: number;
        from: string | undefined;
        to: string | undefined;
    }>;
    getRevenue(from?: string, to?: string): Promise<{
        totalFeesUSD: number;
        devShareUSD: number;
        triolithNetUSD: number;
        safuShareUSD: number;
        stakerShareUSD: number;
        from: string | undefined;
        to: string | undefined;
    }>;
    getAllUsers(): Promise<import("../users/user.entity").User[]>;
    getAllStudios(): Promise<{
        id: string;
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        memberCount: number;
    }[]>;
    getAllTransactions(limit?: string, offset?: string): Promise<{
        events: import("../tax/entities/tax-event.entity").TaxEvent[];
        total: number;
        limit: number;
        offset: number;
    }>;
    setStudioStatus(id: string, body: SetStudioStatusDto, req: AuthRequest): Promise<{
        id: string;
        status: "active" | "suspended";
    }>;
    deleteStudio(id: string, req: AuthRequest): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getStudioGames(id: string): Promise<import("../platform/entities/game.entity").Game[]>;
    setUserAdmin(id: string, body: SetUserAdminDto, req: AuthRequest): Promise<{
        id: string;
        isAdmin: boolean;
    }>;
    setUserSuspended(id: string, body: SetUserSuspendedDto, req: AuthRequest): Promise<{
        id: string;
        isSuspended: boolean;
    }>;
    deleteUser(id: string, req: AuthRequest): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getPlatformFee(): Promise<{
        feePercent: number;
    }>;
    setPlatformFee(body: SetPlatformFeeDto, req: AuthRequest): Promise<{
        feePercent: number;
    }>;
    getAllGames(): Promise<{
        id: string;
        name: string;
        slug: string;
        status: "active" | "inactive";
        studioId: string;
        studioName: string;
        createdAt: Date;
    }[]>;
    setGameStatus(id: string, body: SetGameStatusDto, req: AuthRequest): Promise<{
        id: string;
        status: "active" | "inactive";
    }>;
    getAuditLog(limit?: string, offset?: string): Promise<{
        entries: import("./admin-audit-log.entity").AdminAuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
export {};
