import { Injectable } from "@nestjs/common";
import { TokenShopChainService } from "./tokenshop-chain.service";

@Injectable()
export class TokenShopAdminService {
  constructor(private readonly chainService: TokenShopChainService) {}

  buildUnsignedTx(functionName: string, args: unknown[]) {
    const data = this.chainService.encodeFunctionData(functionName, args);

    return {
      to: this.chainService.getShopAddress(),
      data,
      description: `Call ${functionName}(${args.map(String).join(", ")})`,
    };
  }
}
