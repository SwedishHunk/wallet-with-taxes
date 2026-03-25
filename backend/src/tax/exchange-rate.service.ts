import { Injectable, Logger } from "@nestjs/common";

/**
 * Fetches fiat and crypto prices for Swedish tax calculations.
 *
 * Swedish tax law (Inkomstskattelagen 44 kap) requires all capital
 * gains and losses to be denominated in SEK at the date of each event.
 *
 * Fiat rate source priority:
 *  1. Riksbanken daily rates (authoritative for SEK — riksbank.se)
 *  2. European Central Bank (ecb.europa.eu) as fallback
 *
 * Crypto price source:
 *  - CoinGecko free API v3 (historical prices by coin ID or contract address)
 *  - Unknown/unlisted tokens (e.g. TRI on local chain) return null gracefully
 *
 * Well-known asset map — add entries here when a token gets a CoinGecko listing.
 */

/** Maps lowercase contract address (or symbol) → CoinGecko coin ID */
const KNOWN_ASSETS: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  weth: "weth",
  usdc: "usd-coin",
  usdt: "tether",
  dai: "dai",
  // Add your TRI contract address here once it has a CoinGecko listing:
  // "0xabc123...": "triolith-tri",
};

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  /** Cache: "sekusd:YYYY-MM-DD" → { rate, source } */
  private readonly cache = new Map<string, { rate: number; source: string }>();
  /** Cache: "crypto:{coinId}:YYYY-MM-DD" → price in USD */
  private readonly cryptoCache = new Map<string, number>();

  /**
   * Returns the SEK/USD rate for a given date.
   * Returns null if no rate can be fetched (caller should mark
   * valuationStatus = "missing" and priceSEK = null).
   */
  async getSEKperUSD(
    date: Date,
  ): Promise<{ rate: number; source: string } | null> {
    const key = `sekusd:${this.toDateKey(date)}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const dateKey = this.toDateKey(date);
    const result =
      (await this.fetchFromRiksbanken(dateKey)) ??
      (await this.fetchFromECB(dateKey));

    if (result) this.cache.set(key, result);
    return result ?? null;
  }

  /**
   * Returns the USD price of an asset at a given date.
   * Accepts a CoinGecko coin ID, a well-known symbol, or a contract address.
   * Returns null if the asset is unknown or unlisted (e.g. TRI on local chain).
   */
  async getCryptoPriceUSD(
    assetIdentifier: string,
    date: Date,
  ): Promise<number | null> {
    const coinId = this.resolveCoinId(assetIdentifier);
    if (!coinId) return null;

    const dateKey = this.toDateKey(date);
    const cacheKey = `crypto:${coinId}:${dateKey}`;
    if (this.cryptoCache.has(cacheKey)) return this.cryptoCache.get(cacheKey)!;

    const price = await this.fetchCoinGeckoHistorical(coinId, dateKey);
    if (price != null) this.cryptoCache.set(cacheKey, price);
    return price;
  }

  /**
   * Full resolution: asset identifier → USD price → SEK price.
   * Returns all three fields, or nulls if either lookup fails.
   */
  async getAssetPriceInSEK(
    assetIdentifier: string,
    date: Date,
  ): Promise<{
    priceUSD: number | null;
    priceSEK: number | null;
    exchangeRateSEKUSD: number | null;
    exchangeRateSource: string | null;
    valuationStatus: "authoritative" | "estimated" | "missing";
  }> {
    const priceUSD = await this.getCryptoPriceUSD(assetIdentifier, date);
    if (priceUSD == null) {
      return {
        priceUSD: null,
        priceSEK: null,
        exchangeRateSEKUSD: null,
        exchangeRateSource: null,
        valuationStatus: "missing",
      };
    }

    const sekResult = await this.getSEKperUSD(date);
    return {
      priceUSD,
      priceSEK: sekResult ? +(priceUSD * sekResult.rate).toFixed(4) : null,
      exchangeRateSEKUSD: sekResult?.rate ?? null,
      exchangeRateSource: sekResult?.source ?? null,
      valuationStatus: sekResult ? "authoritative" : "estimated",
    };
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

  // ─── Crypto price helpers ────────────────────────────────────────────────────

  /**
   * Resolves an asset identifier to a CoinGecko coin ID.
   * Accepts: known symbol (eth, usdc…), lowercase contract address, or coin ID.
   * Returns null for unknown assets (e.g. TRI on local devnet).
   */
  private resolveCoinId(identifier: string): string | null {
    const lower = identifier.toLowerCase().trim();
    return KNOWN_ASSETS[lower] ?? null;
  }

  /**
   * CoinGecko free API — historical price for a coin on a specific date.
   * Endpoint: GET /coins/{id}/history?date=dd-mm-yyyy&localization=false
   * Returns the USD market price at that date, or null if unavailable.
   */
  private async fetchCoinGeckoHistorical(
    coinId: string,
    dateKey: string, // "YYYY-MM-DD"
  ): Promise<number | null> {
    try {
      // CoinGecko expects dd-mm-yyyy
      const [year, month, day] = dateKey.split("-");
      const cgDate = `${day}-${month}-${year}`;
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${cgDate}&localization=false`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });

      if (res.status === 429) {
        this.logger.warn(
          `CoinGecko rate limit hit for ${coinId} on ${dateKey}`,
        );
        return null;
      }
      if (!res.ok) return null;

      const json = (await res.json()) as {
        market_data?: { current_price?: { usd?: number } };
      };

      const price = json.market_data?.current_price?.usd;
      if (typeof price !== "number" || !isFinite(price) || price <= 0) {
        return null;
      }
      return price;
    } catch {
      return null;
    }
  }
}
