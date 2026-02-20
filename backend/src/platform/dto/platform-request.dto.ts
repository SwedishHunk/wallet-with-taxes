import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;
}

export class WalletAmountDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount: number;
}

export class TransferBetweenPlayersDto {
  @IsUUID()
  toUserId: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateNftTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  tier?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  upkeepCostPerDay?: string;

  @IsOptional()
  @IsString()
  mintingCost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  maxMintCount?: number;
}

export class MintNftDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

export class UpdateNftDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  equipped?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  condition?: number;

  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, unknown>;
}

export class CreatePersonalAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsObject()
  accessPoints?: Record<string, boolean>;
}

export class LoginPersonalAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UpdatePersonalAccountPermissionsDto {
  @IsObject()
  accessPoints: Record<string, boolean>;
}
