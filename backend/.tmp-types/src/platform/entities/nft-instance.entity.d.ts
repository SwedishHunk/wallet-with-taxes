import { NFTTemplate } from "./nft-template.entity";
import { GamePlayer } from "./game-player.entity";
export declare class NFTInstance {
    id: string;
    template: NFTTemplate;
    owner: GamePlayer;
    contractAddress?: string;
    tokenId?: string;
    txHash?: string;
    name: string;
    description?: string;
    imageUrl?: string;
    level: number;
    condition: number;
    power: number;
    customAttributes: Record<string, any>;
    equipped: boolean;
    lastUpkeepPaid?: Date;
    nextUpkeepDue?: Date;
    createdAt: Date;
    updatedAt: Date;
}
