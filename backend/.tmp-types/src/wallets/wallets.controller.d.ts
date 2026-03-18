import { WalletsService } from "./wallets.service";
import { RegisterWalletDto } from "./dto/wallets-request.dto";
export declare class WalletsController {
    private readonly walletsService;
    constructor(walletsService: WalletsService);
    register(body: RegisterWalletDto): Promise<import("./wallet.entity").Wallet>;
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
    getAssetDetail(id: string, address: string): {
        tokenId: string;
        owner: string;
        type: string;
        name: string;
        image: string;
        description: string;
    };
}
