import {
  IsEmail,
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studioName?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsUUID()
  studioId?: string;
}

export class LinkWalletDto {
  @IsEmail()
  email: string;

  @IsEthereumAddress()
  walletAddress: string;

  /**
   * EIP-191 personal_sign of the message:
   *   "Link wallet to Triolith: <email>"
   * The signature must be produced by the private key of `walletAddress`.
   * This proves the caller controls the destination wallet before we destroy
   * the existing custodial key.
   */
  @IsString()
  @IsNotEmpty()
  signature: string;
}
