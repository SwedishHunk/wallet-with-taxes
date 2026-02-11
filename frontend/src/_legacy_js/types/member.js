// Member, Permissions & Game Access - med Owner-immutability regler
/** Role-presets - endast etiketter, inte auktorisationssystem */
export var MemberRole;
(function (MemberRole) {
    MemberRole["OWNER"] = "owner";
    MemberRole["ADMIN"] = "admin";
    MemberRole["MEMBER"] = "member";
})(MemberRole || (MemberRole = {}));
/** Helper: Generera standard-permissions för en roll (preset) */
export function getRolePresetPermissions(role) {
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
/** Kontrollera om en action är tillåten på en member baserat på Owner-status */
export function checkOwnerImmutability(target) {
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
export function canMemberAdministerOther(actor, target, action) {
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
export function hasMemberGameAccess(member, gameId) {
    return member.gameAccessIds.includes(gameId);
}
/** Hjälpfunktion: Kontrollera om medlem har en specifik permission */
export function hasMemberPermission(member, permission) {
    return member.permissions.includes(permission);
}
