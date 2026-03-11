import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { Response } from "express";

interface TaxCsvRow {
  Date: string;
  Type: string;
  Asset: string;
  TokenID: number;
  Amount: number;
  PriceUSD: number | string;
  FeeUSD: number;
}

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(TaxEvent)
    private readonly repo: Repository<TaxEvent>,
  ) {}

  async logEvent(data: Partial<TaxEvent>) {
    const normalizedData = {
      ...data,
      userAddress: data.userAddress?.toLowerCase(),
      assetAddress: data.assetAddress?.toLowerCase(),
    };
    const event = this.repo.create(normalizedData);
    return this.repo.save(event);
  }
  async getEventsForUser(userAddress: string): Promise<TaxEvent[]> {
    return this.repo.find({
      where: { userAddress: userAddress.toLowerCase() },
      order: { timestamp: "ASC" },
    });
  }

  async getSummary(userAddress: string) {
    const events = await this.getEventsForUser(userAddress);
    // Track user's average cost per asset (assetAddress + tokenId)
    const acquisitions: Record<
      string,
      { totalCost: number; quantity: number }
    > = {};
    let totalGainsUSD = 0;
    let totalLossesUSD = 0;

    for (const e of events) {
      const key = `${e.assetAddress}:${e.tokenId}`;

      if (
        e.type === "acquisition" &&
        e.priceUSD !== null &&
        e.priceUSD !== undefined
      ) {
        // Track acquisition cost and quantity
        if (!acquisitions[key])
          acquisitions[key] = { totalCost: 0, quantity: 0 };

        acquisitions[key].totalCost += e.priceUSD * Number(e.amount);
        acquisitions[key].quantity += Number(e.amount);
      }

      if (
        e.type === "disposal" &&
        e.priceUSD !== null &&
        e.priceUSD !== undefined
      ) {
        const holding = acquisitions[key];
        const avgCost =
          holding && holding.quantity > 0
            ? holding.totalCost / holding.quantity
            : 0;

        const gainOrLoss = (e.priceUSD - avgCost) * Number(e.amount);

        if (gainOrLoss >= 0) {
          totalGainsUSD += gainOrLoss;
        } else {
          totalLossesUSD += gainOrLoss; // will be negative
        }

        // Reduce held quantity/cost (FIFO-like behavior)
        if (holding) {
          const deductedCost = avgCost * Number(e.amount);
          holding.quantity -= Number(e.amount);
          holding.totalCost -= deductedCost;
        }
      }
    }

    // Swedish tax law: capital losses on financial assets are 70% deductible
    // (Inkomstskattelagen 48 kap. 20-24 §§)
    const SWEDISH_LOSS_DEDUCTION_RATE = 0.70;
    const adjustedLossesUSD = totalLossesUSD * SWEDISH_LOSS_DEDUCTION_RATE;
    const netTaxableGainUSD = totalGainsUSD + adjustedLossesUSD;

    return {
      totalGainsUSD: +totalGainsUSD.toFixed(2),
      totalLossesUSD: +totalLossesUSD.toFixed(2),
      adjustedLossesUSD: +adjustedLossesUSD.toFixed(2),
      netTaxableGainUSD: +netTaxableGainUSD.toFixed(2),
    };
  }

  // Prevent CSV formula injection: prefix values starting with =, +, -, @ with a single quote
  private escapeCsvValue(value: string | number): string {
    const str = String(value);
    return /^[=+\-@]/.test(str) ? `'${str}` : str;
  }

  async exportEventsAsCSV(userAddress: string, res: Response): Promise<void> {
    const events = await this.getEventsForUser(userAddress);
    if (events.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=tax-report.csv");
      res.send("Date,Type,Asset,TokenID,Amount,PriceUSD,FeeUSD");
      return;
    }

    const formatted: TaxCsvRow[] = events.map((e) => ({
      Date: e.timestamp.toISOString(),
      Type: e.type,
      Asset: e.assetAddress,
      TokenID: e.tokenId,
      Amount: Number(e.amount),
      PriceUSD: e.priceUSD ?? "",
      FeeUSD: Number(e.feeUSD),
    }));

    const header = Object.keys(formatted[0]).join(",");
    const rows = formatted.map(
      (row) =>
        `${this.escapeCsvValue(row.Date)},${this.escapeCsvValue(row.Type)},${this.escapeCsvValue(row.Asset)},${this.escapeCsvValue(row.TokenID)},${this.escapeCsvValue(row.Amount)},${this.escapeCsvValue(row.PriceUSD)},${this.escapeCsvValue(row.FeeUSD)}`,
    );
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tax-report.csv");
    res.send(csv);
  }
}
