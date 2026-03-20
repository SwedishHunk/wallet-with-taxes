export interface JwtUser {
  id: string;
  email?: string;
  walletAddress?: string;
  /** Undefined for base JWTs issued before studio selection. */
  studioId?: string;
  /** Undefined for base JWTs issued before studio selection. */
  role?: "owner" | "admin" | "member";
  isAdmin: boolean;
}
