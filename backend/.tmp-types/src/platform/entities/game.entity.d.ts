import { Studio } from "./studio.entity";
export declare class Game {
    id: string;
    studio: Studio;
    name: string;
    slug: string;
    description?: string;
    contractAddress?: string;
    status: "active" | "inactive";
    createdAt: Date;
    updatedAt: Date;
}
