import { Repository } from "typeorm";
import { Wallet } from "./wallet.entity";
export declare class WalletsService {
    private readonly walletRepo;
    constructor(walletRepo: Repository<Wallet>);
    registerWallet(owner: string, address: string): Promise<Wallet>;
    getWalletByOwner(owner: string): Promise<Wallet | null>;
    getBalance(address: string): Promise<{
        address: string;
        balance: string;
    }>;
    getAssets(address: string): {
        address: string;
        assets: {
            name: string;
            symbol: string;
            balance: number;
        }[];
    };
    getAssetDetail(address: string, tokenId: string): {
        tokenId: string;
        owner: string;
        type: string;
        name: string;
        image: string;
        description: string;
    };
}
