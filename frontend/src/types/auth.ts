// Authentication & Session States

/** Global auth state - tre möjliga states */
export type AuthState =
  | "Unauthenticated" // Ingen studio-session
  | "StudioAuthenticated" // Studio-session, men ingen member aktiv
  | "Studio+MemberActive"; // Studio + member båda aktiva

/** Studio-sessionsdata (sparas i localStorage/sessionStorage) */
export interface StudioSession {
  studioId: string;
  studioName: string;
  /** Tidsstämpel när sessionen skapades */
  authenticatedAt: string;
  /** True if this user is a Triolith platform-level super-admin */
  isTriolithAdmin?: boolean;
}

/** Member-sessionsdata (sparas i localStorage/sessionStorage) */
export interface MemberSession {
  memberId: string;
  userId: string;
  studioId: string;
  email: string;
  isOwner: boolean;
  /** Vilka permissions medlemmen har (string identifiers) */
  permissions: string[];
  /** Vilka games medlemmen har tillgång till (game IDs) */
  gameAccessIds: string[];
  authenticatedAt: string;
}

/** Global auth context */
export interface AuthContext {
  state: AuthState;
  studioSession: StudioSession | null;
  memberSession: MemberSession | null;
}

/** Permission flags - importeras från member.ts */
export interface PermissionFlags {
  ManageMembers: boolean;
  ManageGames: boolean;
  ManageSettings: boolean;
  MintNFT: boolean;
  MakeTransactions: boolean;
}
