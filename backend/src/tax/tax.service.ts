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

/** One row in the K4 Section D output (crypto assets, genomsnittsmetoden) */
interface K4Row {
  Beteckning: string; // asset description
  Antal: string; // quantity (decimal)
  Forsaljningspris: string; // proceeds in SEK (whole SEK)
  Omkostnadsbelopp: string; // acquisition cost in SEK (whole SEK)
  Vinst: string; // gain (positive) or blank
  Forlust: string; // loss (positive number) or blank
  Notering: string; // warning if SEK values are missing
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

    // Resolve asset price — use caller-supplied priceUSD if present,
    // otherwise try CoinGecko for known assets (ETH, USDC, etc.).
    let resolvedPriceUSD = data.priceUSD ?? null;
    let resolvedValuationStatus = data.valuationStatus ?? "missing";
    let sekFields: Pick<
      TaxEvent,
      "priceSEK" | "exchangeRateSEKUSD" | "exchangeRateSource"
    > = { priceSEK: null, exchangeRateSEKUSD: null, exchangeRateSource: null };

    try {
      if (resolvedPriceUSD != null && resolvedPriceUSD > 0) {
        // Caller supplied a price — just convert to SEK
        const converted = await this.exchangeRateService.convertUSDtoSEK(
          resolvedPriceUSD,
          eventDate,
        );
        sekFields = converted;
        if (converted.priceSEK != null) {
          resolvedValuationStatus = data.valuationStatus ?? "estimated";
        }
      } else if (data.assetAddress) {
        // No price supplied — attempt oracle lookup for known assets
        const oracle = await this.exchangeRateService.getAssetPriceInSEK(
          data.assetAddress,
          eventDate,
        );
        if (oracle.priceUSD != null) {
          resolvedPriceUSD = oracle.priceUSD;
          resolvedValuationStatus = oracle.valuationStatus;
          sekFields = {
            priceSEK: oracle.priceSEK,
            exchangeRateSEKUSD: oracle.exchangeRateSEKUSD,
            exchangeRateSource: oracle.exchangeRateSource,
          };
          this.logger.debug(
            `Oracle price for ${data.assetAddress}: $${resolvedPriceUSD} / ${oracle.priceSEK ?? "?"} SEK`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Price oracle failed for event at ${eventDate.toISOString()}: ${String(err)}`,
      );
    }

    const normalizedData = {
      ...data,
      ...sekFields,
      taxTreatment,
      priceUSD: resolvedPriceUSD ?? data.priceUSD,
      valuationStatus: resolvedValuationStatus,
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
  async getEventsForUser(
    userAddress: string,
    year?: number,
  ): Promise<TaxEvent[]> {
    const qb = this.repo
      .createQueryBuilder("e")
      .where("e.userAddress = :addr", { addr: userAddress.toLowerCase() })
      .orderBy("e.timestamp", "ASC");

    if (year) {
      qb.andWhere("EXTRACT(YEAR FROM e.timestamp) = :year", { year });
    }
    return qb.getMany();
  }

  /**
   * Returns tax summary for a user, optionally filtered to a calendar year.
   * When year is supplied the calculation is always done from raw events
   * (legacy path) since the cost-basis table is lifetime-cumulative.
   * Response includes both USD and SEK totals.
   */
  async getSummary(userAddress: string, year?: number) {
    const normalizedAddress = userAddress.toLowerCase();

    if (year) {
      const result = await this.getSummaryFromEvents(normalizedAddress, year);
      return {
        ...result,
        year,
        projection: await this.getProjectionSummary("legacy-fallback"),
      };
    }

    // Try optimized path: read from cost-basis table (lifetime totals)
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
          totalGainsSEK: null, // lifetime cost-basis table is USD-only
          totalLossesSEK: null,
          netTaxableGainSEK: null,
          year: null,
          projection: await this.getProjectionSummary("cost-basis"),
        };
      }
    } catch (error) {
      await this.markProjectionFailed(error);
    }

    return {
      ...(await this.getSummaryFromEvents(normalizedAddress)),
      year: null,
      projection: await this.getProjectionSummary("legacy-fallback"),
    };
  }

  /**
   * Calculate gains/losses by scanning raw TaxEvents.
   * Supports year filter. Returns both USD and SEK totals where available.
   */
  private async getSummaryFromEvents(userAddress: string, year?: number) {
    const events = await this.getEventsForUser(userAddress, year);
    const acquisitions: Record<
      string,
      { totalCostUSD: number; totalCostSEK: number; quantity: number }
    > = {};
    let totalGainsUSD = 0;
    let totalLossesUSD = 0;
    let totalGainsSEK = 0;
    let totalLossesSEK = 0;
    let hasSEK = false;

    for (const e of events) {
      const key = `${e.assetAddress}:${e.tokenId}`;

      if (e.type === "acquisition" && e.priceUSD != null) {
        if (!acquisitions[key]) {
          acquisitions[key] = { totalCostUSD: 0, totalCostSEK: 0, quantity: 0 };
        }
        acquisitions[key].totalCostUSD += e.priceUSD * Number(e.amount);
        if (e.priceSEK != null) {
          acquisitions[key].totalCostSEK += e.priceSEK * Number(e.amount);
          hasSEK = true;
        }
        acquisitions[key].quantity += Number(e.amount);
      }

      if (e.type === "disposal" && e.priceUSD != null) {
        const holding = acquisitions[key];
        const qty = holding?.quantity ?? 0;
        const avgCostUSD = qty > 0 ? holding.totalCostUSD / qty : 0;
        const avgCostSEK = qty > 0 ? holding.totalCostSEK / qty : 0;
        const glUSD = (e.priceUSD - avgCostUSD) * Number(e.amount);
        if (glUSD >= 0) {
          totalGainsUSD += glUSD;
        } else {
          totalLossesUSD += glUSD;
        }

        if (e.priceSEK != null) {
          const glSEK = (e.priceSEK - avgCostSEK) * Number(e.amount);
          if (glSEK >= 0) {
            totalGainsSEK += glSEK;
          } else {
            totalLossesSEK += glSEK;
          }
          hasSEK = true;
        }

        if (holding) {
          holding.totalCostUSD -= avgCostUSD * Number(e.amount);
          holding.totalCostSEK -= avgCostSEK * Number(e.amount);
          holding.quantity -= Number(e.amount);
        }
      }
    }

    const adjustedLossesUSD = totalLossesUSD * SWEDISH_LOSS_DEDUCTION_RATE;
    const adjustedLossesSEK = totalLossesSEK * SWEDISH_LOSS_DEDUCTION_RATE;

    return {
      totalGainsUSD: +totalGainsUSD.toFixed(2),
      totalLossesUSD: +totalLossesUSD.toFixed(2),
      adjustedLossesUSD: +adjustedLossesUSD.toFixed(2),
      netTaxableGainUSD: +(totalGainsUSD + adjustedLossesUSD).toFixed(2),
      totalGainsSEK: hasSEK ? +totalGainsSEK.toFixed(2) : null,
      totalLossesSEK: hasSEK ? +totalLossesSEK.toFixed(2) : null,
      adjustedLossesSEK: hasSEK ? +adjustedLossesSEK.toFixed(2) : null,
      netTaxableGainSEK: hasSEK
        ? +(totalGainsSEK + adjustedLossesSEK).toFixed(2)
        : null,
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

  async exportEventsAsCSV(
    userAddress: string,
    res: Response,
    year?: number,
  ): Promise<void> {
    const events = await this.getEventsForUser(userAddress, year);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    const yearSuffix = year ? `-${year}` : "";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tax-report-${userAddress.slice(0, 10)}${yearSuffix}.csv`,
    );

    const lines: string[] = [];

    // ── File header ──────────────────────────────────────────────────────────
    lines.push("# INFORMATIONAL ONLY — NOT VERIFIED TAX ADVICE");
    lines.push("# This export is generated for reference purposes only.");
    lines.push(
      "# It does not constitute a completed K4 declaration or verified tax advice.",
    );
    lines.push(
      "# Verify all figures with a qualified Swedish tax advisor before filing.",
    );
    lines.push(
      "# Swedish tax law (IL 44/48 kap): all gains/losses must be reported in SEK.",
    );
    if (year) lines.push(`# Tax year: ${year}`);
    lines.push("#");
    lines.push(
      "# ═══════════════════════════════════════════════════════════════",
    );
    lines.push(
      "# SECTION 1 — K4 SECTION D (Övriga tillgångar / crypto assets)",
    );
    lines.push("# Method: Genomsnittsmetoden (average cost, IL 48 kap 7 §)");
    lines.push("# One row per disposal event. All monetary values in SEK.");
    lines.push(
      "# ═══════════════════════════════════════════════════════════════",
    );
    lines.push("");

    // ── K4 Section D ─────────────────────────────────────────────────────────
    const k4Header =
      "Beteckning,Antal,Forsaljningspris (SEK),Omkostnadsbelopp (SEK),Vinst (SEK),Forlust (SEK),Notering";
    lines.push(k4Header);

    const k4Rows = this.buildK4Rows(events);
    if (k4Rows.length === 0) {
      lines.push("# (inga avyttringar / no disposals found)");
    } else {
      for (const row of k4Rows) {
        lines.push(
          [
            this.escapeCsvValue(row.Beteckning),
            this.escapeCsvValue(row.Antal),
            this.escapeCsvValue(row.Forsaljningspris),
            this.escapeCsvValue(row.Omkostnadsbelopp),
            this.escapeCsvValue(row.Vinst),
            this.escapeCsvValue(row.Forlust),
            this.escapeCsvValue(row.Notering),
          ].join(","),
        );
      }
    }

    // ── Raw event log (reference appendix) ───────────────────────────────────
    lines.push("");
    lines.push(
      "# ═══════════════════════════════════════════════════════════════",
    );
    lines.push("# SECTION 2 — Raw event log (reference only, not for filing)");
    lines.push(
      "# ═══════════════════════════════════════════════════════════════",
    );
    lines.push("");
    lines.push(
      "Date,Type,TaxTreatment,Asset,TokenID,Amount,PriceUSD,PriceSEK,ExchangeRateSEKUSD,ExchangeRateSource,FeeUSD,ValuationStatus",
    );

    for (const e of events) {
      lines.push(
        [
          this.escapeCsvValue(e.timestamp.toISOString()),
          this.escapeCsvValue(e.type),
          this.escapeCsvValue(e.taxTreatment ?? "unknown"),
          this.escapeCsvValue(e.assetAddress),
          this.escapeCsvValue(e.tokenId),
          this.escapeCsvValue(Number(e.amount)),
          this.escapeCsvValue(e.priceUSD ?? ""),
          this.escapeCsvValue(e.priceSEK ?? ""),
          this.escapeCsvValue(e.exchangeRateSEKUSD ?? ""),
          this.escapeCsvValue(e.exchangeRateSource ?? ""),
          this.escapeCsvValue(Number(e.feeUSD)),
          this.escapeCsvValue(e.valuationStatus),
        ].join(","),
      );
    }

    res.send(lines.join("\n"));
  }

  /**
   * Builds K4 Section D rows from raw events using genomsnittsmetoden.
   * Each disposal event produces one K4 row.
   * All monetary values are in SEK; if SEK is unavailable the row is flagged.
   */
  private buildK4Rows(events: TaxEvent[]): K4Row[] {
    // Average cost tracking per assetKey, in both SEK and USD
    const basis: Record<
      string,
      {
        qtySEK: number;
        totalCostSEK: number;
        qtyUSD: number;
        totalCostUSD: number;
      }
    > = {};

    const rows: K4Row[] = [];

    for (const e of events) {
      const key = `${e.assetAddress}:${e.tokenId}`;
      const qty = Number(e.amount);

      if (e.type === "acquisition") {
        if (!basis[key])
          basis[key] = {
            qtySEK: 0,
            totalCostSEK: 0,
            qtyUSD: 0,
            totalCostUSD: 0,
          };
        if (e.priceSEK != null) {
          basis[key].qtySEK += qty;
          basis[key].totalCostSEK += e.priceSEK * qty;
        }
        if (e.priceUSD != null) {
          basis[key].qtyUSD += qty;
          basis[key].totalCostUSD += e.priceUSD * qty;
        }
        continue;
      }

      if (e.type !== "disposal") continue;

      const b = basis[key];
      const hasSEK = e.priceSEK != null && b?.qtySEK > 0;
      const hasUSD = e.priceUSD != null && b?.qtyUSD > 0;

      let forsaljningspris = "";
      let omkostnadsbelopp = "";
      let vinst = "";
      let forlust = "";
      let notering = "";

      if (hasSEK) {
        const avgCostSEK = b.totalCostSEK / b.qtySEK;
        const proceedsSEK = e.priceSEK! * qty;
        const costSEK = avgCostSEK * qty;
        const glSEK = proceedsSEK - costSEK;

        forsaljningspris = Math.round(proceedsSEK).toString();
        omkostnadsbelopp = Math.round(costSEK).toString();
        vinst = glSEK >= 0 ? Math.round(glSEK).toString() : "0";
        forlust = glSEK < 0 ? Math.round(Math.abs(glSEK)).toString() : "0";

        // Update basis
        b.totalCostSEK -= avgCostSEK * qty;
        b.qtySEK -= qty;
      } else if (hasUSD) {
        // SEK unavailable — use USD as fallback with a warning
        const avgCostUSD = b.totalCostUSD / b.qtyUSD;
        const proceedsUSD = e.priceUSD! * qty;
        const costUSD = avgCostUSD * qty;
        const glUSD = proceedsUSD - costUSD;

        forsaljningspris = proceedsUSD.toFixed(2) + " USD";
        omkostnadsbelopp = costUSD.toFixed(2) + " USD";
        vinst = glUSD >= 0 ? glUSD.toFixed(2) + " USD" : "0";
        forlust = glUSD < 0 ? Math.abs(glUSD).toFixed(2) + " USD" : "0";
        notering = "SAKNAS SEK-KURS — kan ej användas för K4-inlämning";

        b.totalCostUSD -= avgCostUSD * qty;
        b.qtyUSD -= qty;
      } else {
        forsaljningspris = "SAKNAS";
        omkostnadsbelopp = "SAKNAS";
        notering = "SAKNAS pris — händelsen kan ej tas upp i K4";
      }

      const assetLabel =
        e.assetAddress.length > 10
          ? `${e.assetAddress.slice(0, 8)}... #${e.tokenId}`
          : `${e.assetAddress} #${e.tokenId}`;

      rows.push({
        Beteckning: assetLabel,
        Antal: qty.toString(),
        Forsaljningspris: forsaljningspris,
        Omkostnadsbelopp: omkostnadsbelopp,
        Vinst: vinst,
        Forlust: forlust,
        Notering: notering,
      });
    }

    return rows;
  }
}
