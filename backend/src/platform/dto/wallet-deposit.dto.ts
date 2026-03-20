import { ApiProperty } from "@nestjs/swagger";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class WalletDepositIntentDto {
  @ApiProperty({ description: 'Amount as decimal string, e.g. "1.5"' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class WalletDepositConfirmDto {
  @ApiProperty({ description: "Intent ID returned by the deposit intent call" })
  @IsUUID()
  intentId: string;

  @ApiProperty({ description: "On-chain transaction hash" })
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiPropertyOptional({
    description: "Optional idempotency key to make retries safe",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}
