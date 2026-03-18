import { Repository } from "typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxCostBasis } from "./entities/tax-cost-basis.entity";
import { Response } from "express";
export declare class TaxService {
    private readonly repo;
    private readonly costBasisRepo;
    constructor(repo: Repository<TaxEvent>, costBasisRepo: Repository<TaxCostBasis>);
    logEvent(data: Partial<TaxEvent>): Promise<TaxEvent>;
    getEventsForUser(userAddress: string): Promise<TaxEvent[]>;
    getSummary(userAddress: string): Promise<{
        totalGainsUSD: number;
        totalLossesUSD: number;
        adjustedLossesUSD: number;
        netTaxableGainUSD: number;
    }>;
    private getSummaryLegacy;
    private updateCostBasis;
    private escapeCsvValue;
    exportEventsAsCSV(userAddress: string, res: Response): Promise<void>;
}
