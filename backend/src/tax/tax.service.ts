import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { TaxEvent } from "./entities/tax-event.entity";
import { TaxCostBasis } from "./entities/tax-cost-basis.entity";
import { TaxProjectionState } from "./entities/tax-projection-state.entity";
import { ExchangeRateService } from "./exchange-rate.service";
import { Response } from "express";
import { SWEDISH_LOSS_DEDUCTION_RATE } from "../shared/constants/business.constants";

interface TaxCsvRow {
  Date: string;
  Type: string;
  TaxTreatment: string;
  Asset: string;
  TokenID: number;
  Amount: number;
  PriceUSD: number | string;
  PriceSEK: number | string;
  ExchangeRateSEKUSD: number | string;
  ExchangeRateSource: string;
  FeeUSD: number;
  ValuationStatus: string;
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);
  private static readonly PROJECTOR = "cost-basis";

  constructor(
    @InjectRepository(TaxEvent)
    private readonly repo: Repository<TaxEvent>,
    @InjectRepository(TaxCostBasis)
    private readonly costBasisRepo: Repository<TaxCostBasis>,
    @InjectRepository(TaxProjectionState)
    private readonly projectionStateRepo: Repository<TaxProjectionState>,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async logEvent(data: Partial<TaxEvent>) {
    const eventDate =
      data.timestamp instanceof Date ? data.timestamp : new Date();

    // Derive taxTreatment from type if not explicitly set
    const taxTreatment: TaxEvent["taxTreatment"] =
      data.taxTreatment ?? (data.type === "reward" ? "income" : "capital_gain");

    // Fetch SEK rate and convert price if we have a USD price
    let sekFields: Pick<
      TaxEvent,
      "priceSEK" | "exchangeRateSEKUSD" | "exchangeRateSource"
    > = { priceSEK: null, exchangeRateSEKUSD: null, exchangeRateSource: null };

    if (data.priceUSD != null && data.priceUSD > 0) {
      try {
        const converted = await this.exchangeRateService.convertUSDtoSEK(
          data.priceUSD,
          eventDate,
        );
        sekFields = converted;
      } catch (err) {
        this.logger.warn(
          `Could not fetch SEK rate for event at ${eventDate.toISOString()}: ${String(err)}`,
        );
      }
    }

    const normalizedData = {
      ...data,
      ...sekFields,
      taxTreatment,
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
        await this.markProjectionHealthy();
      } catch (error) {
        await this.markProjectionFailed(error);
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
          projection: await this.getProjectionSummary("cost-basis"),
        };
      }
      return {
        ...(await this.getSummaryLegacy(normalizedAddress)),
        projection: await this.getProjectionSummary("legacy-fallback"),
      };
    } catch (error) {
      await this.markProjectionFailed(error);
    }

    // Fallback: legacy in-memory calculation (for pre-existing data)
    return {
      ...(await this.getSummaryLegacy(normalizedAddress)),
      projection: await this.getProjectionSummary("legacy-fallback"),
    };
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

  private async getProjectionState() {
    let state = await this.projectionStateRepo.findOne({
      where: { projector: TaxService.PROJECTOR },
    });

    if (!state) {
      state = this.projectionStateRepo.create({
        projector: TaxService.PROJECTOR,
        healthy: true,
        lastError: null,
        lastFailureAt: null,
        lastSuccessAt: null,
      });
    }

    return state;
  }

  private async markProjectionHealthy() {
    const state = await this.getProjectionState();
    state.healthy = true;
    state.lastError = null;
    state.lastSuccessAt = new Date();
    await this.projectionStateRepo.save(state);
  }

  private async markProjectionFailed(error: unknown) {
    const state = await this.getProjectionState();
    const message =
      error instanceof Error ? error.message : "Unknown projection error";

    state.healthy = false;
    state.lastError = message.slice(0, 255);
    state.lastFailureAt = new Date();
    await this.projectionStateRepo.save(state);
    this.logger.error(`Cost-basis projection failed: ${message}`);
  }

  private async getProjectionSummary(mode: "cost-basis" | "legacy-fallback") {
    const state = await this.getProjectionState();
    return {
      mode,
      projector: state.projector,
      healthy: state.healthy,
      lastError: state.lastError,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
    };
  }

  // Prevent CSV formula injection: prefix values starting with =, +, -, @ with a single quote
  private escapeCsvValue(value: string | number): string {
    const str = String(value);
    return /^[=+\-@]/.test(str) ? `'${str}` : str;
  }

  async exportEventsAsCSV(userAddress: string, res: Response): Promise<void> {
    const events = await this.getEventsForUser(userAddress);

    const disclaimer = [
      "# INFORMATIONAL ONLY — NOT VERIFIED TAX ADVICE",
      "# This export is generated for reference purposes only.",
      "# It does not constitute verified tax advice or a completed K4 declaration.",
      "# PriceSEK values require authoritative exchange rates — check ValuationStatus.",
      "# Verify all figures with a qualified Swedish tax advisor before filing.",
      "# Swedish tax law (Inkomstskattelagen): all gains/losses must be reported in SEK.",
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tax-report-${userAddress.slice(0, 10)}.csv`,
    );

    if (events.length === 0) {
      res.send(
        `${disclaimer}\nDate,Type,TaxTreatment,Asset,TokenID,Amount,PriceUSD,PriceSEK,ExchangeRateSEKUSD,ExchangeRateSource,FeeUSD,ValuationStatus`,
      );
      return;
    }

    const formatted: TaxCsvRow[] = events.map((e) => ({
      Date: e.timestamp.toISOString(),
      Type: e.type,
      TaxTreatment: e.taxTreatment ?? "unknown",
      Asset: e.assetAddress,
      TokenID: e.tokenId,
      Amount: Number(e.amount),
      PriceUSD: e.priceUSD ?? "",
      PriceSEK: e.priceSEK ?? "",
      ExchangeRateSEKUSD: e.exchangeRateSEKUSD ?? "",
      ExchangeRateSource: e.exchangeRateSource ?? "",
      FeeUSD: Number(e.feeUSD),
      ValuationStatus: e.valuationStatus,
    }));

    const header = Object.keys(formatted[0]).join(",");
    const rows = formatted.map((row) =>
      [
        this.escapeCsvValue(row.Date),
        this.escapeCsvValue(row.Type),
        this.escapeCsvValue(row.TaxTreatment),
        this.escapeCsvValue(row.Asset),
        this.escapeCsvValue(row.TokenID),
        this.escapeCsvValue(row.Amount),
        this.escapeCsvValue(row.PriceUSD),
        this.escapeCsvValue(row.PriceSEK),
        this.escapeCsvValue(row.ExchangeRateSEKUSD),
        this.escapeCsvValue(row.ExchangeRateSource),
        this.escapeCsvValue(row.FeeUSD),
        this.escapeCsvValue(row.ValuationStatus),
      ].join(","),
    );

    res.send([disclaimer, header, ...rows].join("\n"));
  }
}
