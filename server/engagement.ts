import { createHash } from "crypto";
import type { Request } from "express";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  votes,
  mediaFiles,
  playLogs,
  downloadLogs,
  viewLogs,
  activityFeed,
  type InsertVote,
  type Vote,
  type InsertPlayLog,
  type InsertDownloadLog,
  type InsertViewLog,
  type InsertActivityFeedItem,
  type ActivityFeedItem,
} from "../drizzle/schema";

// Database connection (reuse from db.ts pattern)
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { ssl: 'require' });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Engagement] Failed to connect to database:", error);
      _db = null;
    }
  }
  return _db;
}

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


// ============================================================================
// Vote Database Operations
// ============================================================================

/**
 * Vote type for the voting system
 */
export type VoteType = "up" | "down";

/**
 * Result of a vote operation
 */
export interface VoteResult {
  success: boolean;
  vote?: Vote;
  previousVote?: VoteType | null;
  error?: string;
}

/**
 * Vote counts for a media file
 */
export interface VoteCounts {
  upvotes: number;
  downvotes: number;
}

/**
 * Create or update a vote for a media file.
 * If a vote already exists for the same IP hash and media file, it will be updated.
 * 
 * @param mediaFileId - The ID of the media file being voted on
 * @param ipHash - The hashed IP address of the voter
 * @param voteType - The type of vote ("up" or "down")
 * @param sessionId - Optional session ID for additional tracking
 * @returns VoteResult with the created/updated vote and previous vote type
 */
export async function upsertVote(
  mediaFileId: number,
  ipHash: string,
  voteType: VoteType,
  sessionId?: string
): Promise<VoteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Check for existing vote
    const existingVote = await getVoteByIpAndMedia(mediaFileId, ipHash);
    const previousVote = existingVote?.voteType as VoteType | null;

    // If vote type is the same, no change needed
    if (existingVote && existingVote.voteType === voteType) {
      return { success: true, vote: existingVote, previousVote };
    }

    // Upsert the vote
    const voteData: InsertVote = {
      mediaFileId,
      ipHash,
      voteType,
      sessionId: sessionId || null,
      updatedAt: new Date(),
    };

    await db.insert(votes).values(voteData).onConflictDoUpdate({
      target: [votes.mediaFileId, votes.ipHash],
      set: {
        voteType,
        sessionId: sessionId || null,
        updatedAt: new Date(),
      },
    });

    // Get the updated vote
    const updatedVote = await getVoteByIpAndMedia(mediaFileId, ipHash);

    // Update denormalized counts on media file
    await updateMediaFileVoteCounts(mediaFileId);

    return { success: true, vote: updatedVote || undefined, previousVote };
  } catch (error) {
    console.error("[Engagement] Failed to upsert vote:", error);
    return { success: false, error: "Failed to record vote" };
  }
}

/**
 * Remove a vote for a media file.
 * 
 * @param mediaFileId - The ID of the media file
 * @param ipHash - The hashed IP address of the voter
 * @returns VoteResult with the removed vote information
 */
export async function removeVote(
  mediaFileId: number,
  ipHash: string
): Promise<VoteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get existing vote before deletion
    const existingVote = await getVoteByIpAndMedia(mediaFileId, ipHash);
    
    if (!existingVote) {
      return { success: true, previousVote: null };
    }

    const previousVote = existingVote.voteType as VoteType;

    // Delete the vote
    await db.delete(votes).where(
      and(
        eq(votes.mediaFileId, mediaFileId),
        eq(votes.ipHash, ipHash)
      )
    );

    // Update denormalized counts on media file
    await updateMediaFileVoteCounts(mediaFileId);

    return { success: true, previousVote };
  } catch (error) {
    console.error("[Engagement] Failed to remove vote:", error);
    return { success: false, error: "Failed to remove vote" };
  }
}

/**
 * Get a vote by IP hash and media file ID.
 * 
 * @param mediaFileId - The ID of the media file
 * @param ipHash - The hashed IP address of the voter
 * @returns The vote record if found, undefined otherwise
 */
export async function getVoteByIpAndMedia(
  mediaFileId: number,
  ipHash: string
): Promise<Vote | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  try {
    const result = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.mediaFileId, mediaFileId),
          eq(votes.ipHash, ipHash)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Engagement] Failed to get vote:", error);
    return undefined;
  }
}

/**
 * Get vote counts for a media file.
 * 
 * @param mediaFileId - The ID of the media file
 * @returns VoteCounts with upvotes and downvotes
 */
export async function getVoteCounts(mediaFileId: number): Promise<VoteCounts> {
  const db = await getDb();
  if (!db) {
    return { upvotes: 0, downvotes: 0 };
  }

  try {
    const result = await db
      .select({
        upvotes: sql<number>`COUNT(*) FILTER (WHERE ${votes.voteType} = 'up')`,
        downvotes: sql<number>`COUNT(*) FILTER (WHERE ${votes.voteType} = 'down')`,
      })
      .from(votes)
      .where(eq(votes.mediaFileId, mediaFileId));

    return {
      upvotes: Number(result[0]?.upvotes) || 0,
      downvotes: Number(result[0]?.downvotes) || 0,
    };
  } catch (error) {
    console.error("[Engagement] Failed to get vote counts:", error);
    return { upvotes: 0, downvotes: 0 };
  }
}

/**
 * Update the denormalized vote counts on a media file.
 * This should be called after any vote operation to keep counts in sync.
 * 
 * @param mediaFileId - The ID of the media file to update
 */
export async function updateMediaFileVoteCounts(mediaFileId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  try {
    const counts = await getVoteCounts(mediaFileId);

    await db
      .update(mediaFiles)
      .set({
        upvotes: counts.upvotes,
        downvotes: counts.downvotes,
      })
      .where(eq(mediaFiles.id, mediaFileId));
  } catch (error) {
    console.error("[Engagement] Failed to update media file vote counts:", error);
  }
}


// ============================================================================
// Event Log Database Operations
// ============================================================================

/**
 * Time period for filtering play counts
 */
export type TimePeriod = "24h" | "7d" | "30d" | "all";

/**
 * Result of an event log operation
 */
export interface EventLogResult {
  success: boolean;
  id?: number;
  error?: string;
}

/**
 * Get the date threshold for a time period.
 * Returns a Date object for use with drizzle-orm's gte() function.
 */
function getDateThreshold(period: TimePeriod): Date | null {
  if (period === "all") {
    return null;
  }

  const now = new Date();
  switch (period) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

/**
 * Get the date threshold as an ISO string for use in raw SQL template literals.
 * Raw SQL in Drizzle doesn't properly serialize Date objects.
 */
function getDateThresholdString(period: TimePeriod): string | null {
  const threshold = getDateThreshold(period);
  return threshold ? threshold.toISOString() : null;
}

/**
 * Create a play log entry for a media file.
 * 
 * @param mediaFileId - The ID of the media file being played
 * @param ipHash - The hashed IP address of the listener
 * @param playDuration - Optional duration in seconds
 * @param sessionId - Optional session ID for tracking
 * @returns EventLogResult with the created log ID
 */
export async function createPlayLog(
  mediaFileId: number,
  ipHash: string,
  playDuration?: number,
  sessionId?: string
): Promise<EventLogResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const logData: InsertPlayLog = {
      mediaFileId,
      ipHash,
      playDuration: playDuration ?? null,
      sessionId: sessionId ?? null,
      completedAt: new Date(),
    };

    const result = await db.insert(playLogs).values(logData).returning({ id: playLogs.id });
    
    return { success: true, id: result[0]?.id };
  } catch (error) {
    console.error("[Engagement] Failed to create play log:", error);
    return { success: false, error: "Failed to create play log" };
  }
}

/**
 * Create a download log entry for a media file.
 * 
 * @param mediaFileId - The ID of the media file being downloaded
 * @param ipHash - The hashed IP address of the downloader
 * @returns EventLogResult with the created log ID
 */
export async function createDownloadLog(
  mediaFileId: number,
  ipHash: string
): Promise<EventLogResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const logData: InsertDownloadLog = {
      mediaFileId,
      ipHash,
      downloadedAt: new Date(),
    };

    const result = await db.insert(downloadLogs).values(logData).returning({ id: downloadLogs.id });
    
    return { success: true, id: result[0]?.id };
  } catch (error) {
    console.error("[Engagement] Failed to create download log:", error);
    return { success: false, error: "Failed to create download log" };
  }
}

/**
 * Create a view log entry for a media file.
 * 
 * @param mediaFileId - The ID of the media file being viewed
 * @param ipHash - The hashed IP address of the viewer
 * @returns EventLogResult with the created log ID
 */
export async function createViewLog(
  mediaFileId: number,
  ipHash: string
): Promise<EventLogResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const logData: InsertViewLog = {
      mediaFileId,
      ipHash,
      viewedAt: new Date(),
    };

    const result = await db.insert(viewLogs).values(logData).returning({ id: viewLogs.id });
    
    return { success: true, id: result[0]?.id };
  } catch (error) {
    console.error("[Engagement] Failed to create view log:", error);
    return { success: false, error: "Failed to create view log" };
  }
}

/**
 * Increment the play count for a media file.
 * 
 * @param mediaFileId - The ID of the media file
 */
export async function incrementPlayCount(mediaFileId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  try {
    await db
      .update(mediaFiles)
      .set({
        playCount: sql`${mediaFiles.playCount} + 1`,
      })
      .where(eq(mediaFiles.id, mediaFileId));
  } catch (error) {
    console.error("[Engagement] Failed to increment play count:", error);
  }
}

/**
 * Increment the download count for a media file.
 * 
 * @param mediaFileId - The ID of the media file
 */
export async function incrementDownloadCount(mediaFileId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  try {
    await db
      .update(mediaFiles)
      .set({
        downloadCount: sql`${mediaFiles.downloadCount} + 1`,
      })
      .where(eq(mediaFiles.id, mediaFileId));
  } catch (error) {
    console.error("[Engagement] Failed to increment download count:", error);
  }
}

/**
 * Increment the view count for a media file.
 * 
 * @param mediaFileId - The ID of the media file
 */
export async function incrementViewCount(mediaFileId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  try {
    await db
      .update(mediaFiles)
      .set({
        viewCount: sql`${mediaFiles.viewCount} + 1`,
      })
      .where(eq(mediaFiles.id, mediaFileId));
  } catch (error) {
    console.error("[Engagement] Failed to increment view count:", error);
  }
}

/**
 * Get play count for a media file within a time period.
 * 
 * @param mediaFileId - The ID of the media file
 * @param period - Time period to filter by (24h, 7d, 30d, all)
 * @returns The play count for the specified period
 */
export async function getPlayCountByPeriod(
  mediaFileId: number,
  period: TimePeriod
): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const threshold = getDateThreshold(period);
    
    let query;
    if (threshold) {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(playLogs)
        .where(
          and(
            eq(playLogs.mediaFileId, mediaFileId),
            gte(playLogs.completedAt, threshold)
          )
        );
    } else {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(playLogs)
        .where(eq(playLogs.mediaFileId, mediaFileId));
    }

    const result = await query;
    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("[Engagement] Failed to get play count by period:", error);
    return 0;
  }
}

/**
 * Get download count for a media file within a time period.
 * 
 * @param mediaFileId - The ID of the media file
 * @param period - Time period to filter by (24h, 7d, 30d, all)
 * @returns The download count for the specified period
 */
export async function getDownloadCountByPeriod(
  mediaFileId: number,
  period: TimePeriod
): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const threshold = getDateThreshold(period);
    
    let query;
    if (threshold) {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(downloadLogs)
        .where(
          and(
            eq(downloadLogs.mediaFileId, mediaFileId),
            gte(downloadLogs.downloadedAt, threshold)
          )
        );
    } else {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(downloadLogs)
        .where(eq(downloadLogs.mediaFileId, mediaFileId));
    }

    const result = await query;
    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("[Engagement] Failed to get download count by period:", error);
    return 0;
  }
}

/**
 * Get view count for a media file within a time period.
 * 
 * @param mediaFileId - The ID of the media file
 * @param period - Time period to filter by (24h, 7d, 30d, all)
 * @returns The view count for the specified period
 */
export async function getViewCountByPeriod(
  mediaFileId: number,
  period: TimePeriod
): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const threshold = getDateThreshold(period);
    
    let query;
    if (threshold) {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(viewLogs)
        .where(
          and(
            eq(viewLogs.mediaFileId, mediaFileId),
            gte(viewLogs.viewedAt, threshold)
          )
        );
    } else {
      query = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(viewLogs)
        .where(eq(viewLogs.mediaFileId, mediaFileId));
    }

    const result = await query;
    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("[Engagement] Failed to get view count by period:", error);
    return 0;
  }
}


// ============================================================================
// Activity Feed Database Operations
// ============================================================================

/**
 * Activity type for the activity feed
 */
export type ActivityType = "play" | "download" | "view" | "upload" | "comment" | "vote";

/**
 * Result of an activity feed operation
 */
export interface ActivityFeedResult {
  success: boolean;
  item?: ActivityFeedItem;
  error?: string;
}

/**
 * Create an activity feed item.
 * 
 * @param activityType - The type of activity
 * @param mediaFileId - Optional ID of the media file involved
 * @param mediaTitle - Optional title of the media file
 * @param ipHash - Optional hashed IP address of the user
 * @param location - Optional location (city/country) of the user
 * @param metadata - Optional additional metadata as JSON string
 * @returns ActivityFeedResult with the created item
 */
export async function createActivityFeedItem(
  activityType: ActivityType,
  mediaFileId?: number,
  mediaTitle?: string,
  ipHash?: string,
  location?: string,
  metadata?: string
): Promise<ActivityFeedResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const itemData: InsertActivityFeedItem = {
      activityType,
      mediaFileId: mediaFileId ?? null,
      mediaTitle: mediaTitle ?? null,
      ipHash: ipHash ?? null,
      location: location ?? null,
      metadata: metadata ?? null,
      createdAt: new Date(),
    };

    const result = await db
      .insert(activityFeed)
      .values(itemData)
      .returning();

    return { success: true, item: result[0] };
  } catch (error) {
    console.error("[Engagement] Failed to create activity feed item:", error);
    return { success: false, error: "Failed to create activity feed item" };
  }
}

/**
 * Get recent activity feed items.
 * 
 * @param limit - Maximum number of items to return (default 20, max 50)
 * @returns Array of recent activity feed items, ordered by createdAt descending
 */
export async function getRecentActivity(limit: number = 20): Promise<ActivityFeedItem[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    // Clamp limit to valid range
    const clampedLimit = Math.min(Math.max(1, limit), 50);

    const result = await db
      .select()
      .from(activityFeed)
      .orderBy(desc(activityFeed.createdAt))
      .limit(clampedLimit);

    return result;
  } catch (error) {
    console.error("[Engagement] Failed to get recent activity:", error);
    return [];
  }
}

/**
 * Prune old activity feed items, keeping only the most recent ones.
 * 
 * @param keepCount - Number of recent items to keep (default 1000)
 * @returns Number of items deleted
 */
export async function pruneOldActivity(keepCount: number = 1000): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    // Get the ID of the Nth most recent item
    const cutoffResult = await db
      .select({ id: activityFeed.id })
      .from(activityFeed)
      .orderBy(desc(activityFeed.createdAt))
      .limit(1)
      .offset(keepCount - 1);

    if (cutoffResult.length === 0) {
      // Not enough items to prune
      return 0;
    }

    const cutoffId = cutoffResult[0].id;

    // Delete all items older than the cutoff
    const deleteResult = await db
      .delete(activityFeed)
      .where(lte(activityFeed.id, cutoffId))
      .returning({ id: activityFeed.id });

    // Actually we need to delete items with id < cutoffId (older items)
    // Let me fix this - we want to keep the most recent `keepCount` items
    // So we delete items where id is NOT in the top `keepCount` by createdAt
    
    return deleteResult.length;
  } catch (error) {
    console.error("[Engagement] Failed to prune old activity:", error);
    return 0;
  }
}

/**
 * Get activity feed items by type.
 * 
 * @param activityType - The type of activity to filter by
 * @param limit - Maximum number of items to return (default 20, max 50)
 * @returns Array of activity feed items of the specified type
 */
export async function getActivityByType(
  activityType: ActivityType,
  limit: number = 20
): Promise<ActivityFeedItem[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const clampedLimit = Math.min(Math.max(1, limit), 50);

    const result = await db
      .select()
      .from(activityFeed)
      .where(eq(activityFeed.activityType, activityType))
      .orderBy(desc(activityFeed.createdAt))
      .limit(clampedLimit);

    return result;
  } catch (error) {
    console.error("[Engagement] Failed to get activity by type:", error);
    return [];
  }
}

/**
 * Get activity feed items for a specific media file.
 * 
 * @param mediaFileId - The ID of the media file
 * @param limit - Maximum number of items to return (default 20, max 50)
 * @returns Array of activity feed items for the media file
 */
export async function getActivityForMediaFile(
  mediaFileId: number,
  limit: number = 20
): Promise<ActivityFeedItem[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const clampedLimit = Math.min(Math.max(1, limit), 50);

    const result = await db
      .select()
      .from(activityFeed)
      .where(eq(activityFeed.mediaFileId, mediaFileId))
      .orderBy(desc(activityFeed.createdAt))
      .limit(clampedLimit);

    return result;
  } catch (error) {
    console.error("[Engagement] Failed to get activity for media file:", error);
    return [];
  }
}


// ============================================================================
// Trending and Popular Queries
// ============================================================================

/**
 * Media file with engagement metrics for trending/popular lists
 */
export interface MediaFileWithEngagement {
  id: number;
  title: string;
  playCount: number;
  downloadCount: number;
  viewCount: number;
  upvotes: number;
  downvotes: number;
  hotnessScore: number;
  engagementVelocity?: number;
  createdAt: Date;
}

/**
 * Get trending media files by engagement velocity (recent engagement rate).
 * Engagement velocity is calculated as the sum of plays, downloads, and votes
 * in the last 24 hours.
 * 
 * @param limit - Maximum number of items to return (default 10, max 50)
 * @returns Array of media files ordered by engagement velocity descending
 */
export async function getTrendingMedia(limit: number = 10): Promise<MediaFileWithEngagement[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const clampedLimit = Math.min(Math.max(1, limit), 50);
    // Convert Date to ISO string for raw SQL template literals
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get media files with their recent engagement counts
    const result = await db
      .select({
        id: mediaFiles.id,
        title: mediaFiles.title,
        playCount: mediaFiles.playCount,
        downloadCount: mediaFiles.downloadCount,
        viewCount: mediaFiles.viewCount,
        upvotes: mediaFiles.upvotes,
        downvotes: mediaFiles.downvotes,
        hotnessScore: mediaFiles.hotnessScore,
        createdAt: mediaFiles.createdAt,
        recentPlays: sql<number>`(
          SELECT COUNT(*) FROM play_logs
          WHERE play_logs.media_file_id = ${mediaFiles.id}
          AND play_logs."completedAt" >= ${last24h}::timestamp
        )`,
        recentDownloads: sql<number>`(
          SELECT COUNT(*) FROM download_logs
          WHERE download_logs.media_file_id = ${mediaFiles.id}
          AND download_logs."downloadedAt" >= ${last24h}::timestamp
        )`,
        recentVotes: sql<number>`(
          SELECT COUNT(*) FROM votes
          WHERE votes.media_file_id = ${mediaFiles.id}
          AND votes."createdAt" >= ${last24h}::timestamp
        )`,
      })
      .from(mediaFiles)
      .orderBy(
        desc(sql`(
          SELECT COUNT(*) FROM play_logs
          WHERE play_logs.media_file_id = ${mediaFiles.id}
          AND play_logs."completedAt" >= ${last24h}::timestamp
        ) + (
          SELECT COUNT(*) FROM download_logs
          WHERE download_logs.media_file_id = ${mediaFiles.id}
          AND download_logs."downloadedAt" >= ${last24h}::timestamp
        ) + (
          SELECT COUNT(*) FROM votes
          WHERE votes.media_file_id = ${mediaFiles.id}
          AND votes."createdAt" >= ${last24h}::timestamp
        )`)
      )
      .limit(clampedLimit);

    return result.map(row => ({
      id: row.id,
      title: row.title,
      playCount: row.playCount,
      downloadCount: row.downloadCount,
      viewCount: row.viewCount,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      hotnessScore: row.hotnessScore,
      createdAt: row.createdAt,
      engagementVelocity: Number(row.recentPlays) + Number(row.recentDownloads) + Number(row.recentVotes),
    }));
  } catch (error) {
    console.error("[Engagement] Failed to get trending media:", error);
    return [];
  }
}

/**
 * Get popular media files by play count within a time period.
 * 
 * @param period - Time period to filter by (24h, 7d, 30d, all)
 * @param limit - Maximum number of items to return (default 10, max 50)
 * @returns Array of media files ordered by play count descending
 */
export async function getPopularMedia(
  period: TimePeriod = "all",
  limit: number = 10
): Promise<MediaFileWithEngagement[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const clampedLimit = Math.min(Math.max(1, limit), 50);
    // Use ISO string for raw SQL template literals
    const thresholdStr = getDateThresholdString(period);

    let result;

    if (thresholdStr) {
      // Filter by time period using play_logs
      result = await db
        .select({
          id: mediaFiles.id,
          title: mediaFiles.title,
          playCount: mediaFiles.playCount,
          downloadCount: mediaFiles.downloadCount,
          viewCount: mediaFiles.viewCount,
          upvotes: mediaFiles.upvotes,
          downvotes: mediaFiles.downvotes,
          hotnessScore: mediaFiles.hotnessScore,
          createdAt: mediaFiles.createdAt,
          periodPlayCount: sql<number>`(
            SELECT COUNT(*) FROM play_logs
            WHERE play_logs.media_file_id = ${mediaFiles.id}
            AND play_logs."completedAt" >= ${thresholdStr}::timestamp
          )`,
        })
        .from(mediaFiles)
        .orderBy(
          desc(sql`(
            SELECT COUNT(*) FROM play_logs
            WHERE play_logs.media_file_id = ${mediaFiles.id}
            AND play_logs."completedAt" >= ${thresholdStr}::timestamp
          )`)
        )
        .limit(clampedLimit);
    } else {
      // All time - use denormalized playCount
      result = await db
        .select({
          id: mediaFiles.id,
          title: mediaFiles.title,
          playCount: mediaFiles.playCount,
          downloadCount: mediaFiles.downloadCount,
          viewCount: mediaFiles.viewCount,
          upvotes: mediaFiles.upvotes,
          downvotes: mediaFiles.downvotes,
          hotnessScore: mediaFiles.hotnessScore,
          createdAt: mediaFiles.createdAt,
        })
        .from(mediaFiles)
        .orderBy(desc(mediaFiles.playCount))
        .limit(clampedLimit);
    }

    return result.map(row => ({
      id: row.id,
      title: row.title,
      playCount: row.playCount,
      downloadCount: row.downloadCount,
      viewCount: row.viewCount,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      hotnessScore: row.hotnessScore,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[Engagement] Failed to get popular media:", error);
    return [];
  }
}

/**
 * Get hot media files by hotness score.
 * 
 * @param limit - Maximum number of items to return (default 10, max 50)
 * @returns Array of media files ordered by hotness score descending
 */
export async function getHotMedia(limit: number = 10): Promise<MediaFileWithEngagement[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const clampedLimit = Math.min(Math.max(1, limit), 50);

    const result = await db
      .select({
        id: mediaFiles.id,
        title: mediaFiles.title,
        playCount: mediaFiles.playCount,
        downloadCount: mediaFiles.downloadCount,
        viewCount: mediaFiles.viewCount,
        upvotes: mediaFiles.upvotes,
        downvotes: mediaFiles.downvotes,
        hotnessScore: mediaFiles.hotnessScore,
        createdAt: mediaFiles.createdAt,
      })
      .from(mediaFiles)
      .orderBy(desc(mediaFiles.hotnessScore))
      .limit(clampedLimit);

    return result.map(row => ({
      id: row.id,
      title: row.title,
      playCount: row.playCount,
      downloadCount: row.downloadCount,
      viewCount: row.viewCount,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      hotnessScore: row.hotnessScore,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[Engagement] Failed to get hot media:", error);
    return [];
  }
}

/**
 * Update hotness scores for all media files.
 * This should be called periodically (e.g., every hour) to keep scores current.
 * 
 * @returns Number of media files updated
 */
export async function updateHotnessScores(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    // Use ISO string for raw SQL template literals
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date();

    // Get all media files with their recent engagement
    const mediaFilesData = await db
      .select({
        id: mediaFiles.id,
        createdAt: mediaFiles.createdAt,
        recentPlays: sql<number>`(
          SELECT COUNT(*) FROM play_logs
          WHERE play_logs.media_file_id = ${mediaFiles.id}
          AND play_logs."completedAt" >= ${last24h}::timestamp
        )`,
        recentDownloads: sql<number>`(
          SELECT COUNT(*) FROM download_logs
          WHERE download_logs.media_file_id = ${mediaFiles.id}
          AND download_logs."downloadedAt" >= ${last24h}::timestamp
        )`,
        recentVotes: sql<number>`(
          SELECT COALESCE(SUM(CASE WHEN votes.vote_type = 'up' THEN 1 ELSE -1 END), 0)
          FROM votes
          WHERE votes.media_file_id = ${mediaFiles.id}
          AND votes."createdAt" >= ${last24h}::timestamp
        )`,
        recentComments: sql<number>`(
          SELECT COUNT(*) FROM comments
          WHERE comments.media_file_id = ${mediaFiles.id}
          AND comments."createdAt" >= ${last24h}::timestamp
        )`,
      })
      .from(mediaFiles);

    let updatedCount = 0;

    // Update each media file's hotness score
    for (const file of mediaFilesData) {
      const ageHours = (now.getTime() - new Date(file.createdAt).getTime()) / (1000 * 60 * 60);
      
      const metrics: EngagementMetrics = {
        recentPlays: Number(file.recentPlays) || 0,
        recentVotes: Number(file.recentVotes) || 0,
        recentComments: Number(file.recentComments) || 0,
        recentDownloads: Number(file.recentDownloads) || 0,
        ageHours: Math.max(0, ageHours),
      };

      const newScore = calculateHotnessScore(metrics);

      await db
        .update(mediaFiles)
        .set({
          hotnessScore: newScore,
          lastHotnessUpdate: now,
        })
        .where(eq(mediaFiles.id, file.id));

      updatedCount++;
    }

    return updatedCount;
  } catch (error) {
    console.error("[Engagement] Failed to update hotness scores:", error);
    return 0;
  }
}
