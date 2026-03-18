import { Request } from "express";
import { TaxService } from "./tax.service";
import { Response } from "express";
export declare class TaxController {
    private readonly taxService;
    constructor(taxService: TaxService);
    getSummary(user: string, req: Request): Promise<{
        totalGainsUSD: number;
        totalLossesUSD: number;
        adjustedLossesUSD: number;
        netTaxableGainUSD: number;
    } | {
        error: string;
    }>;
    exportCSV(user: string, req: Request, res: Response): Promise<void>;
    private assertOwnerOrAdmin;
}
