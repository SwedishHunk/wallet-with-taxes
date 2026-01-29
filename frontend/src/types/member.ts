// Member, Permissions & Game Access - med Owner-immutability regler

/** Binary permission flags - source of truth */
export interface PermissionFlags {
  ManageMembers: boolean; // Lägg till/ta bort members, ändra permissions
  ManageGames: boolean; // Skapa/redigera/ta bort games
  ManageSettings: boolean; // Studio-inställningar
  MintNFT: boolean; // Mint NFTs
  MakeTransactions: boolean; // Gör transaktioner
}

/** Studio member - representerar en användare i en studio */
export interface Member {
  id: string;
  userId: string;
  studioId: string;
  email: string;

  /** Owner-status: SEPARAT från permissions. Immutable via normal admin-flöde */
  isOwner: boolean;

  role: MemberRole; // Preset/label endast - inte för auth
  permissions: string[];

  /** Games som medlemmen har tillgång till (game IDs) */
  gameAccessIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Role-presets - endast etiketter, inte auktorisationssystem */
export enum MemberRole {
  OWNER = "owner", // Alla permissions + immutable
  ADMIN = "admin", // Mest allt
  MEMBER = "member", // Begränsade permissions
}

/** Helper: Generera standard-permissions för en roll (preset) */
export function getRolePresetPermissions(role: MemberRole): PermissionFlags {
  switch (role) {
    case MemberRole.OWNER:
      return {
        ManageMembers: true,
        ManageGames: true,
        ManageSettings: true,
        MintNFT: true,
        MakeTransactions: true,
      };
    case MemberRole.ADMIN:
      return {
        ManageMembers: true,
        ManageGames: true,
        ManageSettings: false,
        MintNFT: true,
        MakeTransactions: true,
      };
    case MemberRole.MEMBER:
      return {
        ManageMembers: false,
        ManageGames: false,
        ManageSettings: false,
        MintNFT: false,
        MakeTransactions: false,
      };
  }
}

/**
 * OWNER-IMMUTABILITY RULES
 * Dessa regler gäller ALLTID, backend enforcer dem
 */

export interface OwnerImmutabilityCheck {
  canDelete: boolean;
  canDowngrade: boolean;
  canRemovePermissions: boolean;
  canRemoveGameAccess: boolean;
  reason?: string;
}

/** Kontrollera om en action är tillåten på en member baserat på Owner-status */
export function checkOwnerImmutability(target: Member): OwnerImmutabilityCheck {
  if (!target.isOwner) {
    // Ingen Owner - inga restriktioner
    return {
      canDelete: true,
      canDowngrade: true,
      canRemovePermissions: true,
      canRemoveGameAccess: true,
    };
  }

  // Target är Owner - kan inte modifieras
  return {
    canDelete: false,
    canDowngrade: false,
    canRemovePermissions: false,
    canRemoveGameAccess: false,
    reason: "Owner members are immutable and cannot be modified or deleted",
  };
}

/** Kontrollera om medlem kan administrera annan medlem */
export function canMemberAdministerOther(
  actor: Member,
  target: Member,
  action:
    | "delete"
    | "updatePermissions"
    | "updateGameAccess"
    | "promoteToOwner",
): boolean {
  // Bara Owners kan administrera
  if (!actor.isOwner) {
    return false;
  }

  // Även Owners kan inte ändra andra Owners
  if (target.isOwner && actor.id !== target.id) {
    const immutability = checkOwnerImmutability(target);

    switch (action) {
      case "delete":
        return immutability.canDelete;
      case "updatePermissions":
        return immutability.canRemovePermissions;
      case "updateGameAccess":
        return immutability.canRemoveGameAccess;
      case "promoteToOwner":
        return false; // Kan inte promovera över en Owner
    }
  }

  return true;
}

/** Hjälpfunktion: Kontrollera om medlem har tillgång till en specifik game */
export function hasMemberGameAccess(member: Member, gameId: string): boolean {
  return member.gameAccessIds.includes(gameId);
}

/** Hjälpfunktion: Kontrollera om medlem har en specifik permission */
export function hasMemberPermission(
  member: Member,
  permission: string,
): boolean {
  return member.permissions.includes(permission);
}
