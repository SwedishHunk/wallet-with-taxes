import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ethers } from "ethers";
import { TokenShopAdminService } from "./tokenshop-admin.service";
import { TokenShopAdminApiGuard } from "./guards/tokenshop-admin-api.guard";

type SetRatesBody = { asset?: string; buyRate?: string; sellRate?: string };
type SetFeeBody = { feeBps?: number };
type SetLimitsBody = { maxEthIn?: string; maxGenIn?: string };
type WithdrawEthBody = { to?: string; amountWei?: string };
type SetSupportedTokenBody = { asset?: string; supported?: boolean };
type SetAssetDecimalsBody = { asset?: string; decimals?: number };

@Controller("api/admin")
@UseGuards(TokenShopAdminApiGuard)
export class TokenShopAdminController {
  constructor(private readonly tokenShopAdminService: TokenShopAdminService) {}

  @Post("set-rates")
  setRates(@Body() body: SetRatesBody) {
    const { asset, buyRate, sellRate } = body;
    if (!asset || !ethers.isAddress(asset)) {
      throw new BadRequestException("Invalid asset address");
    }
    if (!buyRate || !sellRate) {
      throw new BadRequestException(
        "buyRate and sellRate are required (raw uint256 strings)",
      );
    }

    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setRates", [
        asset,
        BigInt(buyRate),
        BigInt(sellRate),
      ]),
    };
  }

  @Post("set-fee")
  setFee(@Body() body: SetFeeBody) {
    const { feeBps } = body;
    if (feeBps === undefined || feeBps < 0 || feeBps > 1000) {
      throw new BadRequestException("feeBps must be 0-1000 (0%-10%)");
    }

    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setFeeBps", [
        BigInt(feeBps),
      ]),
    };
  }

  @Post("pause")
  pause() {
    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setPaused", [true]),
    };
  }

  @Post("unpause")
  unpause() {
    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setPaused", [false]),
    };
  }

  @Post("set-limits")
  setLimits(@Body() body: SetLimitsBody) {
    const { maxEthIn, maxGenIn } = body;
    const txs: Array<Record<string, unknown>> = [];

    if (maxEthIn !== undefined) {
      txs.push({
        ...this.tokenShopAdminService.buildUnsignedTx("setMaxEthIn", [
          BigInt(maxEthIn),
        ]),
        label: "setMaxEthIn",
      });
    }

    if (maxGenIn !== undefined) {
      txs.push({
        ...this.tokenShopAdminService.buildUnsignedTx("setMaxGenIn", [
          BigInt(maxGenIn),
        ]),
        label: "setMaxGenIn",
      });
    }

    if (txs.length === 0) {
      throw new BadRequestException("Provide maxEthIn and/or maxGenIn");
    }

    return { txs };
  }

  @Post("withdraw-eth")
  withdrawEth(@Body() body: WithdrawEthBody) {
    const { to, amountWei } = body;
    if (!to || !ethers.isAddress(to)) {
      throw new BadRequestException("Invalid to address");
    }
    if (!amountWei) {
      throw new BadRequestException("amountWei is required");
    }

    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("withdrawETH", [
        to,
        BigInt(amountWei),
      ]),
    };
  }

  @Post("set-supported-token")
  setSupportedToken(@Body() body: SetSupportedTokenBody) {
    const { asset, supported } = body;
    if (!asset || !ethers.isAddress(asset)) {
      throw new BadRequestException("Invalid asset address");
    }
    if (typeof supported !== "boolean") {
      throw new BadRequestException("supported must be true or false");
    }

    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setSupportedToken", [
        asset,
        supported,
      ]),
    };
  }

  @Post("set-asset-decimals")
  setAssetDecimals(@Body() body: SetAssetDecimalsBody) {
    const { asset, decimals } = body;
    if (!asset || !ethers.isAddress(asset)) {
      throw new BadRequestException("Invalid asset address");
    }
    if (decimals === undefined || decimals < 0 || decimals > 18) {
      throw new BadRequestException("decimals must be 0-18");
    }

    return {
      tx: this.tokenShopAdminService.buildUnsignedTx("setAssetDecimals", [
        asset,
        decimals,
      ]),
    };
  }
}
