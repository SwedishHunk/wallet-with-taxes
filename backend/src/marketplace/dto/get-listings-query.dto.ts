import { IsOptional, IsString } from "class-validator";

export class GetListingsQueryDto {
  @IsOptional()
  @IsString()
  status?: "active" | "sold" | "cancelled";

  @IsOptional()
  @IsString()
  tokenId?: number;
}
