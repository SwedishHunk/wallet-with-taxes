import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsString } from "class-validator";

export class ListItemDto {
  @ApiProperty({
    example: "0x...",
    description: "ERC-1155 token contract address",
  })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: "ERC-1155 token ID" })
  @IsInt()
  tokenId: number;

  @ApiProperty({ description: "Number of tokens to list" })
  @IsInt()
  amount: number;

  @ApiProperty({ description: "Price per unit in the platform token" })
  @IsNumber()
  pricePerUnit: number;
}
