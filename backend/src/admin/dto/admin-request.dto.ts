import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNumber, Max, Min } from "class-validator";

export class SetStudioStatusDto {
  @ApiProperty({ enum: ["active", "suspended"] })
  @IsIn(["active", "suspended"])
  status: "active" | "suspended";
}

export class SetUserAdminDto {
  @ApiProperty()
  @IsBoolean()
  isAdmin: boolean;
}

export class SetUserSuspendedDto {
  @ApiProperty()
  @IsBoolean()
  suspended: boolean;
}

export class SetPlatformFeeDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent: number;
}

export class SetGameStatusDto {
  @ApiProperty({ enum: ["active", "inactive"] })
  @IsIn(["active", "inactive"])
  status: "active" | "inactive";
}
