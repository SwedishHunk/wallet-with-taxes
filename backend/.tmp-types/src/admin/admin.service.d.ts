import { TaxEvent } from "../tax/entities/tax-event.entity";
import { User } from "../users/user.entity";
import { Studio } from "../platform/entities/studio.entity";
import { Game } from "../platform/entities/game.entity";
import { EconomicEvent } from "../economics/entities/economic-event.entity";
import { PlatformConfig } from "./platform-config.entity";
import { AdminAuditLog } from "./admin-audit-log.entity";
import { Repository } from "typeorm";
export declare class AdminService {
    private readonly taxRepo;
    private readonly userRepo;
    private readonly studioRepo;
    private readonly gameRepo;
    private readonly economicEventRepo;
    private readonly platformConfigRepo;
    private readonly auditLogRepo;
    constructor(taxRepo: Repository<TaxEvent>, userRepo: Repository<User>, studioRepo: Repository<Studio>, gameRepo: Repository<Game>, economicEventRepo: Repository<EconomicEvent>, platformConfigRepo: Repository<PlatformConfig>, auditLogRepo: Repository<AdminAuditLog>);
    private writeAudit;
    getFeeStats(from?: string, to?: string): Promise<{
        totalFeesUSD: number;
        totalTrades: number;
        from: string | undefined;
        to: string | undefined;
    }>;
    getRevenueSplit(from?: string, to?: string): Promise<{
        totalFeesUSD: number;
        devShareUSD: number;
        triolithNetUSD: number;
        safuShareUSD: number;
        stakerShareUSD: number;
        from: string | undefined;
        to: string | undefined;
    }>;
    getUserList(): Promise<User[]>;
    getAllStudios(): Promise<{
        id: string;
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        memberCount: number;
    }[]>;
    getAllTransactions(limit?: number, offset?: number): Promise<{
        events: TaxEvent[];
        total: number;
        limit: number;
        offset: number;
    }>;
    setStudioStatus(id: string, status: "active" | "suspended", adminId: string, adminEmail: string): Promise<{
        id: string;
        status: "active" | "suspended";
    }>;
    setUserAdmin(id: string, isAdmin: boolean, adminId: string, adminEmail: string): Promise<{
        id: string;
        isAdmin: boolean;
    }>;
    setUserSuspended(id: string, isSuspended: boolean, adminId: string, adminEmail: string): Promise<{
        id: string;
        isSuspended: boolean;
    }>;
    getPlatformFee(): Promise<{
        feePercent: number;
    }>;
    setPlatformFee(feePercent: number, adminId: string, adminEmail: string): Promise<{
        feePercent: number;
    }>;
    deleteUser(id: string, adminId: string, adminEmail: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    deleteStudio(id: string, adminId: string, adminEmail: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getAuditLog(limit?: number, offset?: number): Promise<{
        entries: AdminAuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getStudioGames(studioId: string): Promise<Game[]>;
    getAllGames(): Promise<{
        id: string;
        name: string;
        slug: string;
        status: "active" | "inactive";
        studioId: string;
        studioName: string;
        createdAt: Date;
    }[]>;
    setGameStatus(id: string, status: "active" | "inactive", adminId: string, adminEmail: string): Promise<{
        id: string;
        status: "active" | "inactive";
    }>;
}
