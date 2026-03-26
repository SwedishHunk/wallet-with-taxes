import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewAmlFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
