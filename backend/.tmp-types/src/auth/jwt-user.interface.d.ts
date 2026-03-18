export interface JwtUser {
    id: string;
    email?: string;
    walletAddress?: string;
    studioId: string;
    role: "owner" | "admin" | "member";
    isAdmin: boolean;
}
