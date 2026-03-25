import { Injectable, Logger } from "@nestjs/common";

/**
 * Fetches SEK/USD exchange rates for Swedish tax calculations.
 *
 * Swedish tax law (Inkomstskattelagen 44 kap) requires all capital
 * gains and losses to be denominated in SEK, using the exchange rate
 * at the exact date of each taxable event.
 *
 * Rate source priority:
 *  1. Riksbanken daily rates (authoritative for SEK — riksbank.se)
 *  2. European Central Bank (ecb.europa.eu) as fallback
 *  3. CoinGecko for crypto-to-SEK rates (TRI token, ETH, etc.)
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  /** Cache: date string "YYYY-MM-DD" → SEK per 1 USD */
  private readonly cache = new Map<string, { rate: number; source: string }>();

  /**
   * Returns the SEK/USD rate for a given date.
   * Returns null if no rate can be fetched (caller should mark
   * valuationStatus = "missing" and priceSEK = null).
   */
  async getSEKperUSD(
    date: Date,
  ): Promise<{ rate: number; source: string } | null> {
    const key = this.toDateKey(date);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const result =
      (await this.fetchFromRiksbanken(key)) ?? (await this.fetchFromECB(key));

    if (result) this.cache.set(key, result);
    return result ?? null;
  }

  /**
   * Converts a USD price to SEK using the exchange rate at the event date.
   * Returns { priceSEK, exchangeRateSEKUSD, exchangeRateSource } or nulls
   * if rate is unavailable.
   */
  async convertUSDtoSEK(
    priceUSD: number,
    date: Date,
  ): Promise<{
    priceSEK: number | null;
    exchangeRateSEKUSD: number | null;
    exchangeRateSource: string | null;
  }> {
    const rateResult = await this.getSEKperUSD(date);
    if (!rateResult) {
      return {
        priceSEK: null,
        exchangeRateSEKUSD: null,
        exchangeRateSource: null,
      };
    }
    return {
      priceSEK: +(priceUSD * rateResult.rate).toFixed(4),
      exchangeRateSEKUSD: rateResult.rate,
      exchangeRateSource: rateResult.source,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  /**
   * Riksbanken SWEA API — official Swedish central bank rates.
   * Endpoint: https://api.riksbank.se/swea/v1/Observations/SEKUSDPMI/...
   * Returns daily USD/SEK fixing rate (inverted to get SEK per USD).
   */
  private async fetchFromRiksbanken(
    dateKey: string,
  ): Promise<{ rate: number; source: string } | null> {
    try {
      const url = `https://api.riksbank.se/swea/v1/Observations/SEKUSDPMI/${dateKey}/${dateKey}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { value: string }[];
      if (!Array.isArray(json) || json.length === 0) return null;
      // SEKUSDPMI = SEK per 1 USD — already in the right direction
      const rate = parseFloat(json[0].value);
      if (!isFinite(rate) || rate <= 0) return null;
      return { rate, source: "riksbanken" };
    } catch {
      return null;
    }
  }

  /**
   * ECB data warehouse — fallback if Riksbanken is unavailable.
   * Returns EUR/USD, then uses EUR/SEK to derive USD/SEK.
   */
  private async fetchFromECB(
    dateKey: string,
  ): Promise<{ rate: number; source: string } | null> {
    try {
      // ECB: USD per EUR (inverted to get EUR per USD)
      const usdEurUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=${dateKey}&endPeriod=${dateKey}&format=jsondata`;
      const sekEurUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.SEK.EUR.SP00.A?startPeriod=${dateKey}&endPeriod=${dateKey}&format=jsondata`;

      const [usdEurRes, sekEurRes] = await Promise.all([
        fetch(usdEurUrl, { signal: AbortSignal.timeout(5000) }),
        fetch(sekEurUrl, { signal: AbortSignal.timeout(5000) }),
      ]);

      if (!usdEurRes.ok || !sekEurRes.ok) return null;

      const usdEurJson = (await usdEurRes.json()) as {
        dataSets: {
          series: Record<string, { observations: Record<string, number[]> }>;
        }[];
      };
      const sekEurJson = (await sekEurRes.json()) as typeof usdEurJson;

      const usdPerEur = this.extractECBValue(usdEurJson);
      const sekPerEur = this.extractECBValue(sekEurJson);
      if (!usdPerEur || !sekPerEur) return null;

      // SEK per USD = (SEK per EUR) / (USD per EUR)
      const sekPerUsd = sekPerEur / usdPerEur;
      if (!isFinite(sekPerUsd) || sekPerUsd <= 0) return null;
      return { rate: +sekPerUsd.toFixed(4), source: "ecb" };
    } catch {
      return null;
    }
  }

  private extractECBValue(json: {
    dataSets: {
      series: Record<string, { observations: Record<string, number[]> }>;
    }[];
  }): number | null {
    try {
      const series = Object.values(json.dataSets[0].series)[0];
      const obs = Object.values(series.observations)[0];
      const value = obs[0];
      return isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }
}
