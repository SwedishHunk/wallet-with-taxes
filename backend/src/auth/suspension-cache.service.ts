import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Distributed suspension cache.
 *
 * Production (REDIS_URL set): uses Redis with a 5-second TTL.
 *   - Suspension takes effect within 5 s across all instances.
 *   - setUserSuspended() invalidates the key immediately (0-second propagation
 *     to any instance that reads from the same Redis).
 *
 * Development / no Redis (REDIS_URL absent): falls back to an in-process Map
 *   with a 5-second TTL. Suspension propagates only within the same process,
 *   but the TTL is short enough to be acceptable for single-instance dev.
 */
@Injectable()
export class SuspensionCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(SuspensionCacheService.name);
  private readonly redis: Redis | null = null;

  /** In-process fallback when Redis is unavailable */
  private readonly localCache = new Map<
    string,
    { suspended: boolean; expiresAt: number }
  >();
  private readonly LOCAL_TTL_MS = 5_000; // 5 seconds
  private readonly REDIS_TTL_SEC = 5; // 5 seconds

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
      });
      this.redis.on("error", (err) => {
        this.logger.warn(
          `Redis connection error — falling back to local cache: ${String(err)}`,
        );
      });
      this.redis.on("connect", () => {
        this.logger.log("Redis connected — suspension cache is distributed");
      });
    } else {
      this.logger.warn(
        "REDIS_URL not set — using in-process suspension cache (single-instance only). " +
          "Set REDIS_URL for production multi-instance deployments.",
      );
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  /**
   * Returns the cached suspension status for a user, or null if not cached.
   * Null means the caller must fetch from the DB and then call set().
   */
  async get(userId: string): Promise<boolean | null> {
    if (this.redis?.status === "ready") {
      try {
        const value = await this.redis.get(`suspension:${userId}`);
        if (value === null) return null;
        return value === "1";
      } catch {
        // Redis read failed — fall through to local cache
      }
    }

    const entry = this.localCache.get(userId);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.suspended;
    }
    this.localCache.delete(userId);
    return null;
  }

  /** Stores the suspension status for a user. */
  async set(userId: string, suspended: boolean): Promise<void> {
    if (this.redis?.status === "ready") {
      try {
        await this.redis.set(
          `suspension:${userId}`,
          suspended ? "1" : "0",
          "EX",
          this.REDIS_TTL_SEC,
        );
        return;
      } catch {
        // Redis write failed — fall through to local cache
      }
    }

    this.localCache.set(userId, {
      suspended,
      expiresAt: Date.now() + this.LOCAL_TTL_MS,
    });
  }

  /**
   * Immediately removes a user's cached suspension status.
   * Call this from setUserSuspended() so the change takes effect on the
   * next request rather than waiting for TTL expiry.
   */
  async invalidate(userId: string): Promise<void> {
    if (this.redis?.status === "ready") {
      try {
        await this.redis.del(`suspension:${userId}`);
      } catch {
        // best-effort
      }
    }
    this.localCache.delete(userId);
  }
}
