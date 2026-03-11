import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Contract, ethers, JsonRpcProvider } from "ethers";
import { ERC20_ABI, TOKENSHOP_ABI } from "./tokenshop.abi";

const ETH_ADDRESS = ethers.ZeroAddress.toLowerCase();

@Injectable()
export class TokenShopChainService {
  private readonly rpcUrl?: string;
  private readonly tokenShopAddress?: string;
  private readonly provider: JsonRpcProvider | null;
  private readonly contract: Contract | null;
  private readonly symbolCache = new Map<string, string>([
    [ETH_ADDRESS, "ETH"],
  ]);
  private readonly decimalsCache = new Map<string, number>([[ETH_ADDRESS, 18]]);

  constructor(private readonly configService: ConfigService) {
    this.rpcUrl = this.configService.get<string>("RPC_URL")?.trim();
    this.tokenShopAddress = this.configService
      .get<string>("TOKENSHOP_ADDRESS")
      ?.trim()
      .toLowerCase();

    this.provider = this.rpcUrl ? new JsonRpcProvider(this.rpcUrl) : null;
    this.contract =
      this.provider && this.tokenShopAddress
        ? new Contract(this.tokenShopAddress, TOKENSHOP_ABI, this.provider)
        : null;
  }

  get ethAddress() {
    return ETH_ADDRESS;
  }

  ensureConfigured() {
    if (!this.provider || !this.contract || !this.tokenShopAddress) {
      throw new Error(
        "TokenShop is not configured. Missing RPC_URL or TOKENSHOP_ADDRESS.",
      );
    }
  }

  getProvider() {
    this.ensureConfigured();
    return this.provider!;
  }

  getContract() {
    this.ensureConfigured();
    return this.contract!;
  }

  getShopAddress() {
    return this.tokenShopAddress ?? null;
  }

  normalizeAsset(asset?: string | null) {
    return (asset ?? ETH_ADDRESS).toLowerCase();
  }

  async getTokenAddress() {
    const contract = this.getContract();
    const tokenAddress = (await contract.token()) as string;
    return tokenAddress.toLowerCase();
  }

  async getAssetSymbol(asset: string) {
    const normalized = this.normalizeAsset(asset);
    const cached = this.symbolCache.get(normalized);
    if (cached) {
      return cached;
    }

    let symbol = normalized;
    try {
      const erc20 = new Contract(normalized, ERC20_ABI, this.getProvider());
      symbol = (await erc20.symbol()) as string;
    } catch {
      symbol = normalized;
    }

    this.symbolCache.set(normalized, symbol);
    return symbol;
  }

  async getAssetDecimals(asset: string) {
    const normalized = this.normalizeAsset(asset);
    const cached = this.decimalsCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    let decimals = 18;
    try {
      decimals = Number(await this.getContract().assetDecimals(normalized));
    } catch {
      try {
        const erc20 = new Contract(normalized, ERC20_ABI, this.getProvider());
        decimals = Number(await erc20.decimals());
      } catch {
        decimals = 18;
      }
    }

    this.decimalsCache.set(normalized, decimals);
    return decimals;
  }

  formatAmount(asset: string, amountRaw: bigint, decimals: number) {
    if (this.normalizeAsset(asset) === ETH_ADDRESS) {
      return Number(ethers.formatEther(amountRaw));
    }

    return Number(ethers.formatUnits(amountRaw, decimals));
  }

  parseEthAmount(amount: string) {
    return ethers.parseEther(amount);
  }

  parseTokenAmount(amount: string, decimals: number) {
    return ethers.parseUnits(amount, decimals);
  }

  encodeFunctionData(functionName: string, args: unknown[]) {
    return this.getContract().interface.encodeFunctionData(functionName, args);
  }
}
