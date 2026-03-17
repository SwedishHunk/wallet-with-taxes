import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

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
}
