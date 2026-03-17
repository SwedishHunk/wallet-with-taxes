import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateGameDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "my-game",
    description:
      "URL-safe slug: lowercase letters, numbers and hyphens only (e.g. my-game)",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "Slug may only contain lowercase letters, numbers and hyphens (e.g. my-game)",
  })
  slug: string;
}

export class WalletAmountDto {
  @ApiProperty({ description: "Positive decimal amount" })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount: number;
}

export class TransferBetweenPlayersDto {
  @ApiProperty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({ description: "Positive decimal amount" })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateNftTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  tier?: number;

  @ApiPropertyOptional({ description: "Arbitrary key/value attributes" })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Daily upkeep cost as decimal string" })
  @IsOptional()
  @IsString()
  upkeepCostPerDay?: string;

  @ApiPropertyOptional({ description: "Minting cost as decimal string" })
  @IsOptional()
  @IsString()
  mintingCost?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  maxMintCount?: number;
}

export class MintNftDto {
  @ApiPropertyOptional({
    description: "Mint directly into a target user's wallet",
  })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

export class UpdateNftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  equipped?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  condition?: number;

  @ApiPropertyOptional({ description: "Arbitrary key/value overrides" })
  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, unknown>;
}

export class CreatePersonalAccountDto {
  @ApiProperty({ example: "member@studio.io" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: "Map of access-point names to booleans" })
  @IsOptional()
  @IsObject()
  accessPoints?: Record<string, boolean>;
}

export class LoginPersonalAccountDto {
  @ApiProperty({ example: "member@studio.io" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UpdatePersonalAccountPermissionsDto {
  @ApiProperty({ description: "Map of access-point names to booleans" })
  @IsObject()
  accessPoints: Record<string, boolean>;
}
