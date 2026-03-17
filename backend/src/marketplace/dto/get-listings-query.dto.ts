import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional } from "class-validator";

export class GetListingsQueryDto {
  @ApiPropertyOptional({ enum: ["active", "sold", "cancelled"] })
  @IsOptional()
  @IsIn(["active", "sold", "cancelled"])
  status?: "active" | "sold" | "cancelled";

  @ApiPropertyOptional({ description: "Filter by ERC-1155 token ID" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tokenId?: number;
}
