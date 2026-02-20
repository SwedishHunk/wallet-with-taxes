import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEthereumAddress,
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
}
