import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsNotEmpty, IsString } from "class-validator";

export class RegisterWalletDto {
  @ApiProperty({ description: "Owner identifier (user ID or label)" })
  @IsString()
  @IsNotEmpty()
  owner: string;

  @ApiProperty({ example: "0x..." })
  @IsEthereumAddress()
  address: string;
}
