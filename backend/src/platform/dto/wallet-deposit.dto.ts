import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class WalletDepositIntentDto {
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class WalletDepositConfirmDto {
  @IsUUID()
  intentId: string;

  @IsString()
  @IsNotEmpty()
  txHash: string;
}
