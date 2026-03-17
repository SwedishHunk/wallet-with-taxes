import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxCostBasis } from "./entities/tax-cost-basis.entity";
import { Response } from "express";
import { SWEDISH_LOSS_DEDUCTION_RATE } from "../shared/constants/business.constants";

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
    @InjectRepository(TaxCostBasis)
    private readonly costBasisRepo: Repository<TaxCostBasis>,
  ) {}

  async logEvent(data: Partial<TaxEvent>) {
    const normalizedData = {
      ...data,
      userAddress: data.userAddress?.toLowerCase(),
      assetAddress: data.assetAddress?.toLowerCase(),
    };
    const event = this.repo.create(normalizedData);
    const saved = await this.repo.save(event);

    // Incrementally update cost-basis table
    if (
      saved.userAddress &&
      saved.assetAddress &&
      (saved.type === "acquisition" || saved.type === "disposal")
    ) {
      try {
        await this.updateCostBasis(saved);
      } catch {
        // Table may not exist yet — skip silently
      }
    }

    return saved;
  }
  async getEventsForUser(userAddress: string): Promise<TaxEvent[]> {
    return this.repo.find({
      where: { userAddress: userAddress.toLowerCase() },
      order: { timestamp: "ASC" },
    });
  }

  async getSummary(userAddress: string) {
    const normalizedAddress = userAddress.toLowerCase();

    // Try optimized path: read from cost-basis table
    try {
      const bases = await this.costBasisRepo.find({
        where: { userAddress: normalizedAddress },
      });

      if (bases.length > 0) {
        let totalGainsUSD = 0;
        let totalLossesUSD = 0;
        for (const b of bases) {
          totalGainsUSD += Number(b.realizedGains);
          totalLossesUSD += Number(b.realizedLosses);
        }
        const adjustedLossesUSD = totalLossesUSD * SWEDISH_LOSS_DEDUCTION_RATE;
        const netTaxableGainUSD = totalGainsUSD + adjustedLossesUSD;

        return {
          totalGainsUSD: +totalGainsUSD.toFixed(2),
          totalLossesUSD: +totalLossesUSD.toFixed(2),
          adjustedLossesUSD: +adjustedLossesUSD.toFixed(2),
          netTaxableGainUSD: +netTaxableGainUSD.toFixed(2),
        };
      }
    } catch {
      // Table may not exist yet — fall through to legacy path
    }

    // Fallback: legacy in-memory calculation (for pre-existing data)
    return this.getSummaryLegacy(normalizedAddress);
  }

  /**
   * Legacy in-memory calculation — used only as fallback when
   * cost-basis table hasn't been populated yet.
   */
  private async getSummaryLegacy(userAddress: string) {
    const events = await this.getEventsForUser(userAddress);
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
          totalLossesUSD += gainOrLoss;
        }
        if (holding) {
          const deductedCost = avgCost * Number(e.amount);
          holding.quantity -= Number(e.amount);
          holding.totalCost -= deductedCost;
        }
      }
    }

    const adjustedLossesUSD = totalLossesUSD * SWEDISH_LOSS_DEDUCTION_RATE;
    const netTaxableGainUSD = totalGainsUSD + adjustedLossesUSD;

    return {
      totalGainsUSD: +totalGainsUSD.toFixed(2),
      totalLossesUSD: +totalLossesUSD.toFixed(2),
      adjustedLossesUSD: +adjustedLossesUSD.toFixed(2),
      netTaxableGainUSD: +netTaxableGainUSD.toFixed(2),
    };
  }

  /**
   * Incrementally update the cost-basis table for a single tax event.
   * Called from logEvent() after persisting the event.
   */
  private async updateCostBasis(event: TaxEvent) {
    const assetKey = `${event.assetAddress}:${event.tokenId}`;
    let basis = await this.costBasisRepo.findOne({
      where: { userAddress: event.userAddress, assetKey },
    });

    if (!basis) {
      basis = this.costBasisRepo.create({
        userAddress: event.userAddress,
        assetKey,
        quantity: 0,
        totalCost: 0,
        realizedGains: 0,
        realizedLosses: 0,
        lastProcessedEventId: 0,
      });
    }

    // Skip if already processed (idempotency)
    if (event.id <= basis.lastProcessedEventId) return;

    const amount = Number(event.amount);
    const price = event.priceUSD ?? 0;

    if (event.type === "acquisition" && price > 0) {
      basis.quantity = Number(basis.quantity) + amount;
      basis.totalCost = Number(basis.totalCost) + price * amount;
    }

    if (event.type === "disposal" && price > 0) {
      const avgCost =
        Number(basis.quantity) > 0
          ? Number(basis.totalCost) / Number(basis.quantity)
          : 0;
      const gainOrLoss = (price - avgCost) * amount;

      if (gainOrLoss >= 0) {
        basis.realizedGains = Number(basis.realizedGains) + gainOrLoss;
      } else {
        basis.realizedLosses = Number(basis.realizedLosses) + gainOrLoss;
      }

      const deductedCost = avgCost * amount;
      basis.quantity = Number(basis.quantity) - amount;
      basis.totalCost = Number(basis.totalCost) - deductedCost;
    }

    basis.lastProcessedEventId = event.id;
    await this.costBasisRepo.save(basis);
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
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=tax-report.csv",
      );
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
