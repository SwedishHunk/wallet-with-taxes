import { TokenShopListenerService } from "./tokenshop-listener.service";
export declare class TokenShopSyncController {
    private readonly tokenShopListenerService;
    constructor(tokenShopListenerService: TokenShopListenerService);
    syncNow(): Promise<{
        status: string;
        lastSyncedBlock: number;
    }>;
}
