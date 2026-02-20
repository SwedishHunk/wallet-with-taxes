import { IsString, IsInt, IsNumber } from "class-validator";

export class ListItemDto {
  @IsString()
  tokenAddress: string;

  @IsInt()
  tokenId: number;

  @IsInt()
  amount: number;

  @IsNumber()
  pricePerUnit: number;
}
