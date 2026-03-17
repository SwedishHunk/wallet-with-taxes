import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class TradeDto {
  @ApiProperty({ description: "ID of the listing to purchase from" })
  @IsInt()
  listingId: number;

  @ApiProperty({ description: "Number of tokens to purchase" })
  @IsInt()
  amount: number;
}
