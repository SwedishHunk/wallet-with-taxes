import { ConfigService } from "@nestjs/config";
import { Contract, ethers } from "ethers";
export declare class TokenShopChainService {
    private readonly configService;
    private readonly rpcUrl?;
    private readonly tokenShopAddress?;
    private readonly provider;
    private readonly contract;
    private readonly symbolCache;
    private readonly decimalsCache;
    constructor(configService: ConfigService);
    get ethAddress(): string;
    ensureConfigured(): void;
    getProvider(): ethers.JsonRpcProvider;
    getContract(): Contract;
    getShopAddress(): string | null;
    normalizeAsset(asset?: string | null): string;
    getTokenAddress(): Promise<string>;
    getAssetSymbol(asset: string): Promise<string>;
    getAssetDecimals(asset: string): Promise<number>;
    formatAmount(asset: string, amountRaw: bigint, decimals: number): number;
    parseEthAmount(amount: string): bigint;
    parseTokenAmount(amount: string, decimals: number): bigint;
    encodeFunctionData(functionName: string, args: unknown[]): string;
}
