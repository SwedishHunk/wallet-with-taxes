export declare class AdminAuditLog {
    id: string;
    adminId: string;
    adminEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
    createdAt: Date;
}
