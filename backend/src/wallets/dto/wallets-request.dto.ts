import { IsEthereumAddress, IsNotEmpty, IsString } from "class-validator";

export class RegisterWalletDto {
  @IsString()
  @IsNotEmpty()
  owner: string;

  @IsEthereumAddress()
  address: string;
}
