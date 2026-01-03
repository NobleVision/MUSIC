import { createHash } from "crypto";
import type { Request } from "express";

/**
 * Hash an IP address using SHA-256 for privacy protection.
 * The hash is deterministic - same IP always produces the same hash.
 * 
 * @param ip - The IP address to hash
 * @returns A 64-character hexadecimal SHA-256 hash
 */
export function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Extract the client IP address from request headers.
 * Checks X-Forwarded-For, X-Real-IP, and falls back to socket address.
 * 
 * @param req - Express request object
 * @returns The client IP address or "unknown" if not determinable
 */
export function getClientIP(req: Request): string {
  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
  // The first one is the original client IP
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(",")[0];
    return ips.trim();
  }

  // X-Real-IP is set by some proxies (like nginx)
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // Fall back to socket remote address
  const socketIP = req.socket?.remoteAddress;
  if (socketIP) {
    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
    if (socketIP.startsWith("::ffff:")) {
      return socketIP.slice(7);
    }
    return socketIP;
  }

  return "unknown";
}

/**
 * Get a hashed version of the client IP for privacy-preserving tracking.
 * Combines IP extraction and hashing in one step.
 * 
 * @param req - Express request object
 * @returns A SHA-256 hash of the client IP address
 */
export function getClientIpHash(req: Request): string {
  const ip = getClientIP(req);
  return hashIP(ip);
}


// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Rate limit configuration for different action types
 */
export interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;  // Unix timestamp when the limit resets
}

/**
 * Default rate limit configurations per action type
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  vote: { maxRequests: 10, windowMs: 60 * 1000 },        // 10 votes per minute
  play: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 plays per hour
  download: { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 downloads per hour
  view: { maxRequests: 200, windowMs: 60 * 60 * 1000 }, // 200 views per hour
};

/**
 * In-memory rate limiter with configurable limits per action type.
 * Uses a sliding window approach for accurate rate limiting.
 */
export class RateLimiter {
  private store: Map<string, { timestamps: number[]; windowMs: number }> = new Map();
  private configs: Record<string, RateLimitConfig>;

  constructor(configs: Record<string, RateLimitConfig> = DEFAULT_RATE_LIMITS) {
    this.configs = configs;
  }

  /**
   * Generate a unique key for rate limiting based on IP hash and action type
   */
  private getKey(ipHash: string, actionType: string): string {
    return `${actionType}:${ipHash}`;
  }

  /**
   * Clean up expired timestamps from the store
   */
  private cleanup(key: string, windowMs: number): number[] {
    const now = Date.now();
    const entry = this.store.get(key);
    
    if (!entry) {
      return [];
    }

    // Filter out timestamps outside the current window
    const validTimestamps = entry.timestamps.filter(ts => now - ts < windowMs);
    
    if (validTimestamps.length === 0) {
      this.store.delete(key);
    } else {
      entry.timestamps = validTimestamps;
    }

    return validTimestamps;
  }

  /**
   * Check if an action is allowed and record it if so.
   * 
   * @param ipHash - Hashed IP address of the client
   * @param actionType - Type of action (vote, play, download, view)
   * @returns RateLimitResult with allowed status, remaining attempts, and reset time
   */
  check(ipHash: string, actionType: string): RateLimitResult {
    const config = this.configs[actionType];
    
    if (!config) {
      // Unknown action type - allow by default
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
      };
    }

    const key = this.getKey(ipHash, actionType);
    const now = Date.now();
    
    // Clean up and get valid timestamps
    const timestamps = this.cleanup(key, config.windowMs);
    
    // Calculate remaining attempts
    const remaining = Math.max(0, config.maxRequests - timestamps.length);
    
    // Calculate reset time (when the oldest timestamp expires)
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + config.windowMs 
      : now + config.windowMs;

    // Check if limit exceeded
    if (timestamps.length >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Record this request
    if (!this.store.has(key)) {
      this.store.set(key, { timestamps: [], windowMs: config.windowMs });
    }
    this.store.get(key)!.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      resetTime,
    };
  }

  /**
   * Check if an action would be allowed without recording it.
   * Useful for checking rate limit status without consuming an attempt.
   */
  peek(ipHash: string, actionType: string): RateLimitResult {
    const config = this.configs[actionType];
    
    if (!config) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
      };
    }

    const key = this.getKey(ipHash, actionType);
    const now = Date.now();
    
    // Clean up and get valid timestamps
    const timestamps = this.cleanup(key, config.windowMs);
    
    const remaining = Math.max(0, config.maxRequests - timestamps.length);
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + config.windowMs 
      : now + config.windowMs;

    return {
      allowed: timestamps.length < config.maxRequests,
      remaining,
      resetTime,
    };
  }

  /**
   * Reset rate limit for a specific IP and action type.
   * Useful for testing or administrative purposes.
   */
  reset(ipHash: string, actionType: string): void {
    const key = this.getKey(ipHash, actionType);
    this.store.delete(key);
  }

  /**
   * Clear all rate limit data.
   * Useful for testing.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the current configuration for an action type
   */
  getConfig(actionType: string): RateLimitConfig | undefined {
    return this.configs[actionType];
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();


// ============================================================================
// Hotness Score Calculator
// ============================================================================

/**
 * Engagement metrics used to calculate hotness score
 */
export interface EngagementMetrics {
  recentPlays: number;      // plays in last 24h
  recentVotes: number;      // net votes (upvotes - downvotes) in last 24h
  recentComments: number;   // comments in last 24h
  recentDownloads: number;  // downloads in last 24h
  ageHours: number;         // hours since upload
}

/**
 * Weights for different engagement types in hotness calculation
 */
export const HOTNESS_WEIGHTS = {
  play: 1.0,
  vote: 2.0,
  comment: 3.0,
  download: 1.5,
} as const;

/**
 * Half-life for time decay in hours (24 hours)
 */
export const HOTNESS_HALF_LIFE_HOURS = 24;

/**
 * Calculate the hotness score for a media file based on engagement metrics.
 * 
 * The formula uses a weighted sum of engagement metrics with time decay:
 * - Plays are weighted at 1.0
 * - Votes (net) are weighted at 2.0
 * - Comments are weighted at 3.0
 * - Downloads are weighted at 1.5
 * 
 * Time decay is applied using a half-life of 24 hours, meaning content
 * loses half its score every 24 hours of age.
 * 
 * @param metrics - Engagement metrics for the media file
 * @returns Hotness score as an integer (multiplied by 100 for precision)
 */
export function calculateHotnessScore(metrics: EngagementMetrics): number {
  const {
    recentPlays,
    recentVotes,
    recentComments,
    recentDownloads,
    ageHours,
  } = metrics;

  // Calculate weighted sum of engagement
  const rawScore =
    recentPlays * HOTNESS_WEIGHTS.play +
    recentVotes * HOTNESS_WEIGHTS.vote +
    recentComments * HOTNESS_WEIGHTS.comment +
    recentDownloads * HOTNESS_WEIGHTS.download;

  // Apply time decay (half-life of 24 hours)
  // Formula: score * 0.5^(ageHours / halfLife)
  const decayFactor = Math.pow(0.5, ageHours / HOTNESS_HALF_LIFE_HOURS);

  // Return score multiplied by 100 and rounded for integer storage
  return Math.round(rawScore * decayFactor * 100);
}

/**
 * Compare two media files by their hotness scores.
 * Returns positive if a is hotter, negative if b is hotter, 0 if equal.
 * 
 * @param metricsA - Engagement metrics for first media file
 * @param metricsB - Engagement metrics for second media file
 * @returns Comparison result for sorting (descending order)
 */
export function compareByHotness(
  metricsA: EngagementMetrics,
  metricsB: EngagementMetrics
): number {
  return calculateHotnessScore(metricsB) - calculateHotnessScore(metricsA);
}
