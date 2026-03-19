import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Contract, ethers } from "ethers";
import { Repository } from "typeorm";
import { ShopEvent } from "./entities/shop-event.entity";
import { TokenShopChainService } from "./tokenshop-chain.service";
import { ERC20_ABI } from "./tokenshop.abi";

@Injectable()
export class TokenShopQueryService {
  // Record the process start time so callers can see how stale the env-var
  // price snapshot is without needing access to the listener service.
  private readonly ethUsdSnapshotAt = new Date().toISOString();

  // Runtime overrides (survive until process restart; override env vars)
  private runtimeEthUsd: number | null = null;
  private runtimeUsdSek: number | null = null;

  setValuation(ethUsd?: number, usdSek?: number) {
    if (ethUsd !== undefined) this.runtimeEthUsd = ethUsd > 0 ? ethUsd : null;
    if (usdSek !== undefined) this.runtimeUsdSek = usdSek > 0 ? usdSek : null;
  }

  constructor(
    private readonly chainService: TokenShopChainService,
    @InjectRepository(ShopEvent)
    private readonly shopEventRepo: Repository<ShopEvent>,
  ) {}

  async getShopConfig() {
    const contract = this.chainService.getContract();
    const tokenAddress = await this.chainService.getTokenAddress();
    const ethUsd = this.runtimeEthUsd ?? this.parseEnvNumber(process.env.TOKENSHOP_ETH_USD);
    const usdSek = this.runtimeUsdSek ?? this.parseEnvNumber(process.env.TOKENSHOP_USD_SEK);

    const [
      feeBps,
      maxEthIn,
      maxGenIn,
      paused,
      buyRateEth,
      sellRateEth,
      totalSupply,
    ] = await Promise.all([
      (contract.feeBps() as Promise<bigint>).catch(() => 0n),
      (contract.maxEthIn() as Promise<bigint>).catch(() => 0n),
      (contract.maxGenIn() as Promise<bigint>).catch(() => 0n),
      (contract.paused() as Promise<boolean>).catch(() => false),
      (contract.buyRate(ethers.ZeroAddress) as Promise<bigint>).catch(() => 0n),
      (contract.sellRate(ethers.ZeroAddress) as Promise<bigint>).catch(
        () => 0n,
      ),
      this.getTokenSupply(tokenAddress),
    ]);

    return {
      shopAddress: this.chainService.getShopAddress(),
      tokenAddress,
      paused,
      feeBps: Number(feeBps),
      feePercent: Number(feeBps) / 100,
      maxEthIn: ethers.formatEther(maxEthIn),
      maxGenIn: ethers.formatUnits(maxGenIn, 18),
      rates: {
        eth: {
          buyRate: ethers.formatUnits(buyRateEth, 18),
          sellRate: ethers.formatUnits(sellRateEth, 18),
        },
      },
      valuation: {
        ethUsd,
        usdSek,
        source:
          ethUsd !== null || usdSek !== null
            ? "manual_env_snapshot"
            : "unconfigured",
        snapshotLoadedAt: this.ethUsdSnapshotAt,
      },
      genTotalSupply: totalSupply,
    };
  }

  async getShopLiquidity() {
    const provider = this.chainService.getProvider();
    const shopAddress = this.chainService.getShopAddress();
    if (!shopAddress) {
      throw new Error("TokenShop address is not configured.");
    }

    const ethBalance = await provider.getBalance(shopAddress);
    const liquidity: Record<string, string | number | null> = {
      ETH: ethers.formatEther(ethBalance),
    };

    const knownAssets = await this.shopEventRepo
      .createQueryBuilder("shopEvent")
      .select("DISTINCT shopEvent.asset", "asset")
      .getRawMany<{ asset: string }>();

    for (const { asset } of knownAssets) {
      const normalized = this.chainService.normalizeAsset(asset);
      if (normalized === this.chainService.ethAddress) {
        continue;
      }

      const symbol = await this.chainService.getAssetSymbol(normalized);
      const decimals = await this.chainService.getAssetDecimals(normalized);

      try {
        const erc20 = new Contract(normalized, ERC20_ABI, provider);
        const balance = (await erc20.balanceOf(shopAddress)) as bigint;
        liquidity[symbol] = Number(ethers.formatUnits(balance, decimals));
      } catch {
        liquidity[symbol] = null;
      }
    }

    return liquidity;
  }

  async getSupportedAssets() {
    const contract = this.chainService.getContract();
    const seenSymbols = new Set<string>(["ETH"]);
    const seenAddresses = new Set<string>([this.chainService.ethAddress]);

    const [ethBuyRate, ethSellRate] = await Promise.all([
      (contract.buyRate(ethers.ZeroAddress) as Promise<bigint>).catch(() => 0n),
      (contract.sellRate(ethers.ZeroAddress) as Promise<bigint>).catch(
        () => 0n,
      ),
    ]);

    const assets = [
      {
        address: ethers.ZeroAddress,
        symbol: "ETH",
        decimals: 18,
        buyRate: ethers.formatUnits(ethBuyRate, 18),
        sellRate: ethers.formatUnits(ethSellRate, 18),
      },
    ];

    const knownAssets = await this.shopEventRepo
      .createQueryBuilder("shopEvent")
      .select([
        "shopEvent.asset AS asset",
        "shopEvent.assetSymbol AS assetSymbol",
      ])
      .groupBy("shopEvent.asset")
      .addGroupBy("shopEvent.assetSymbol")
      .getRawMany<{ asset: string; assetSymbol: string }>();

    for (const { asset, assetSymbol } of knownAssets) {
      const normalized = this.chainService.normalizeAsset(asset);
      if (seenAddresses.has(normalized)) {
        continue;
      }
      seenAddresses.add(normalized);

      try {
        const isSupported = (await contract.supportedTokens(
          normalized,
        )) as boolean;
        if (!isSupported) {
          continue;
        }

        let symbol = await this.chainService.getAssetSymbol(normalized);
        if (symbol === normalized && assetSymbol) {
          symbol = assetSymbol;
        }

        if (seenSymbols.has(symbol)) {
          continue;
        }

        const decimals = await this.chainService.getAssetDecimals(normalized);
        const [buyRate, sellRate] = await Promise.all([
          (contract.buyRate(normalized) as Promise<bigint>).catch(() => 0n),
          (contract.sellRate(normalized) as Promise<bigint>).catch(() => 0n),
        ]);

        if (buyRate === 0n && sellRate === 0n) {
          continue;
        }

        seenSymbols.add(symbol);
        assets.push({
          address: normalized,
          symbol,
          decimals,
          buyRate: ethers.formatUnits(buyRate, 18),
          sellRate: ethers.formatUnits(sellRate, 18),
        });
      } catch {
        continue;
      }
    }

    return assets;
  }

  async quoteBuyEth(amount: string) {
    const weiIn = this.chainService.parseEthAmount(amount);
    const genOut = (await this.chainService
      .getContract()
      .getQuoteBuyETH(weiIn)) as bigint;

    return {
      asset: "ETH",
      amountIn: amount,
      genOut: ethers.formatUnits(genOut, 18),
      note: "Gross quote (before fees)",
    };
  }

  async quoteSellEth(gen: string) {
    const genIn = this.chainService.parseTokenAmount(gen, 18);
    const ethOut = (await this.chainService
      .getContract()
      .getQuoteSellToETH(genIn)) as bigint;

    return {
      asset: "ETH",
      genIn: gen,
      amountOut: ethers.formatEther(ethOut),
      note: "Gross quote (before fees)",
    };
  }

  async quoteBuyToken(asset: string, amount: string) {
    const normalized = this.chainService.normalizeAsset(asset);
    const decimals = await this.chainService.getAssetDecimals(normalized);
    const symbol = await this.chainService.getAssetSymbol(normalized);
    const amountIn = this.chainService.parseTokenAmount(amount, decimals);
    const genOut = (await this.chainService
      .getContract()
      .getQuoteBuyToken(normalized, amountIn)) as bigint;

    return {
      asset: normalized,
      symbol,
      amountIn: amount,
      genOut: ethers.formatUnits(genOut, 18),
      note: "Gross quote (before fees)",
    };
  }

  async quoteSellToken(asset: string, gen: string) {
    const normalized = this.chainService.normalizeAsset(asset);
    const decimals = await this.chainService.getAssetDecimals(normalized);
    const symbol = await this.chainService.getAssetSymbol(normalized);
    const genIn = this.chainService.parseTokenAmount(gen, 18);
    const amountOut = (await this.chainService
      .getContract()
      .getQuoteSellToToken(normalized, genIn)) as bigint;

    return {
      asset: normalized,
      symbol,
      genIn: gen,
      amountOut: ethers.formatUnits(amountOut, decimals),
      note: "Gross quote (before fees)",
    };
  }

  async getUserBalance(userAddress: string) {
    const normalizedUser = userAddress.toLowerCase();
    const tokenAddress = await this.chainService.getTokenAddress();
    const erc20 = new Contract(
      tokenAddress,
      ERC20_ABI,
      this.chainService.getProvider(),
    );
    const balance = (await erc20.balanceOf(normalizedUser)) as bigint;

    return {
      user: normalizedUser,
      tokenAddress,
      genBalance: ethers.formatUnits(balance, 18),
    };
  }

  private async getTokenSupply(tokenAddress: string) {
    try {
      const erc20 = new Contract(
        tokenAddress,
        ERC20_ABI,
        this.chainService.getProvider(),
      );
      const totalSupply = (await erc20.totalSupply()) as bigint;
      return ethers.formatUnits(totalSupply, 18);
    } catch {
      return "0";
    }
  }

  private parseEnvNumber(value?: string) {
    if (!value?.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
