import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
