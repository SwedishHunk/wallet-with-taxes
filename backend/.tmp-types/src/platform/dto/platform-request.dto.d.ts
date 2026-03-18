export declare class CreateGameDto {
    name: string;
    slug: string;
}
export declare class WalletAmountDto {
    amount: number;
}
export declare class TransferBetweenPlayersDto {
    toUserId: string;
    amount: number;
    description?: string;
}
export declare class CreateNftTemplateDto {
    name: string;
    tier?: number;
    attributes?: Record<string, unknown>;
    upkeepCostPerDay?: string;
    mintingCost?: string;
    maxMintCount?: number;
}
export declare class MintNftDto {
    targetUserId?: string;
}
export declare class UpdateNftDto {
    equipped?: boolean;
    condition?: number;
    customAttributes?: Record<string, unknown>;
}
export declare class CreatePersonalAccountDto {
    email: string;
    password: string;
    accessPoints?: Record<string, boolean>;
}
export declare class LoginPersonalAccountDto {
    email: string;
    password: string;
}
export declare class UpdatePersonalAccountPermissionsDto {
    accessPoints: Record<string, boolean>;
}
