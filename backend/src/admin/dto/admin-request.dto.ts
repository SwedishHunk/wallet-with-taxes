import { IsBoolean, IsIn, IsNumber, Max, Min } from "class-validator";

export class SetStudioStatusDto {
  @IsIn(["active", "suspended"])
  status: "active" | "suspended";
}

export class SetUserAdminDto {
  @IsBoolean()
  isAdmin: boolean;
}

export class SetUserSuspendedDto {
  @IsBoolean()
  suspended: boolean;
}

export class SetPlatformFeeDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent: number;
}

export class SetGameStatusDto {
  @IsIn(["active", "inactive"])
  status: "active" | "inactive";
}
