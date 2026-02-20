import { IsInt } from "class-validator";

export class TradeDto {
  @IsInt()
  listingId: number;

  @IsInt()
  amount: number;
}
