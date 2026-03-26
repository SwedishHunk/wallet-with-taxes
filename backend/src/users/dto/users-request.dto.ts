import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class SignupDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: "Display name for the studio" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studioName?: string;

  /**
   * GDPR Article 7 — explicit consent to data processing.
   * Must be true for signup to succeed.
   */
  @ApiProperty({ description: "GDPR consent — must be true to register" })
  @IsBoolean()
  gdprConsent: boolean;
}

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: "Log in to a specific studio by ID" })
  @IsOptional()
  @IsUUID()
  studioId?: string;
}

export class SelectStudioDto {
  @ApiProperty({ description: "Studio ID to activate" })
  @IsUUID()
  studioId: string;
}

/**
 * DAC8 / CARF — Update the authenticated user's tax identification number.
 * Accepts national TIN in any standard format (Swedish personnummer, EU TIN,
 * etc.).  The value is stored as-is; no country-specific checksum validation
 * is performed to remain compatible with all EU member-state formats.
 */
export class UpdateTinDto {
  @ApiProperty({
    description:
      "National tax identification number (e.g. Swedish personnummer '19900101-1234', DE TIN '12345678901'). Required for DAC8/CARF EU reporting.",
    example: "19900101-1234",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(30)
  taxIdentificationNumber: string;
}

export class LinkWalletDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "0x..." })
  @IsEthereumAddress()
  walletAddress: string;

  /**
   * EIP-191 personal_sign of the message:
   *   "Link wallet to Triolith: <email>"
   * The signature must be produced by the private key of `walletAddress`.
   * This proves the caller controls the destination wallet before we destroy
   * the existing custodial key.
   */
  @ApiProperty({
    description:
      'EIP-191 personal_sign of "Link wallet to Triolith: <email>" — proves wallet ownership',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
