import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { hashIP, getClientIP, getClientIpHash, RateLimiter, calculateHotnessScore, HOTNESS_WEIGHTS, HOTNESS_HALF_LIFE_HOURS, type EngagementMetrics } from "./engagement";

/**
 * Feature: social-engagement, Property 13: IP Hashing for Privacy
 * Validates: Requirements 8.3
 * 
 * For any stored vote, play log, download log, view log, or activity feed item,
 * the ipHash field SHALL be a SHA-256 hash of the original IP address, not the
 * plain IP address. The hash SHALL be deterministic (same IP always produces same hash).
 */
describe("IP Hashing for Privacy (Property 13)", () => {
  // Property: Hash is deterministic - same IP always produces same hash
  it("should produce deterministic hashes (same IP always produces same hash)", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        const hash1 = hashIP(ip);
        const hash2 = hashIP(ip);
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 100 }
    );
  });

  // Property: Hash is not the plain IP address
  it("should not return the plain IP address as the hash", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        const hash = hashIP(ip);
        expect(hash).not.toBe(ip);
      }),
      { numRuns: 100 }
    );
  });

  // Property: Hash is a valid SHA-256 hex string (64 characters, hex only)
  it("should produce a valid SHA-256 hex string (64 hex characters)", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        const hash = hashIP(ip);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }),
      { numRuns: 100 }
    );
  });

  // Property: Different IPs produce different hashes (collision resistance)
  it("should produce different hashes for different IPs", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.ipV4().filter((ip2) => true), // Generate two IPs
        (ip1, ip2) => {
          // Only test when IPs are different
          fc.pre(ip1 !== ip2);
          const hash1 = hashIP(ip1);
          const hash2 = hashIP(ip2);
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: IPv6 addresses also produce valid hashes
  it("should handle IPv6 addresses and produce valid hashes", () => {
    fc.assert(
      fc.property(fc.ipV6(), (ip) => {
        const hash = hashIP(ip);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }),
      { numRuns: 100 }
    );
  });
});

describe("getClientIP", () => {
  it("should extract IP from X-Forwarded-For header", () => {
    const mockReq = {
      headers: {
        "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    expect(getClientIP(mockReq)).toBe("192.168.1.1");
  });

  it("should extract IP from X-Real-IP header", () => {
    const mockReq = {
      headers: {
        "x-real-ip": "192.168.1.100",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    expect(getClientIP(mockReq)).toBe("192.168.1.100");
  });

  it("should fall back to socket remote address", () => {
    const mockReq = {
      headers: {},
      socket: { remoteAddress: "10.0.0.50" },
    } as any;

    expect(getClientIP(mockReq)).toBe("10.0.0.50");
  });

  it("should handle IPv6-mapped IPv4 addresses", () => {
    const mockReq = {
      headers: {},
      socket: { remoteAddress: "::ffff:192.168.1.1" },
    } as any;

    expect(getClientIP(mockReq)).toBe("192.168.1.1");
  });

  it("should return 'unknown' when no IP can be determined", () => {
    const mockReq = {
      headers: {},
      socket: {},
    } as any;

    expect(getClientIP(mockReq)).toBe("unknown");
  });
});

describe("getClientIpHash", () => {
  it("should return a hashed IP from request", () => {
    const mockReq = {
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
      socket: {},
    } as any;

    const hash = getClientIpHash(mockReq);
    const expectedHash = hashIP("192.168.1.1");
    
    expect(hash).toBe(expectedHash);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});


// Custom arbitrary for generating SHA-256 like hex strings (64 hex characters)
const hexHash = () => fc.array(
  fc.oneof(
    fc.constant('0'), fc.constant('1'), fc.constant('2'), fc.constant('3'),
    fc.constant('4'), fc.constant('5'), fc.constant('6'), fc.constant('7'),
    fc.constant('8'), fc.constant('9'), fc.constant('a'), fc.constant('b'),
    fc.constant('c'), fc.constant('d'), fc.constant('e'), fc.constant('f')
  ),
  { minLength: 64, maxLength: 64 }
).map(arr => arr.join(''));

/**
 * Feature: social-engagement, Property 12: Rate Limiting Enforcement
 * Validates: Requirements 8.1, 8.2
 * 
 * For any IP hash, if the number of actions of a given type exceeds the configured
 * limit within the time window, subsequent actions SHALL be rejected with a rate
 * limit error. Actions below the limit SHALL succeed.
 */
describe("Rate Limiting Enforcement (Property 12)", () => {
  // Property: Actions below limit should succeed
  it("should allow actions below the configured limit", () => {
    fc.assert(
      fc.property(
        hexHash(), // ipHash
        fc.integer({ min: 1, max: 10 }), // maxRequests
        fc.integer({ min: 1000, max: 60000 }), // windowMs
        (ipHash, maxRequests, windowMs) => {
          const limiter = new RateLimiter({
            test: { maxRequests, windowMs },
          });

          // All requests up to the limit should be allowed
          for (let i = 0; i < maxRequests; i++) {
            const result = limiter.check(ipHash, "test");
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(maxRequests - i - 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Actions exceeding limit should be rejected
  it("should reject actions after limit is exceeded", () => {
    fc.assert(
      fc.property(
        hexHash(), // ipHash
        fc.integer({ min: 1, max: 10 }), // maxRequests
        (ipHash, maxRequests) => {
          const limiter = new RateLimiter({
            test: { maxRequests, windowMs: 60000 },
          });

          // Exhaust the limit
          for (let i = 0; i < maxRequests; i++) {
            limiter.check(ipHash, "test");
          }

          // Next request should be rejected
          const result = limiter.check(ipHash, "test");
          expect(result.allowed).toBe(false);
          expect(result.remaining).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Different IPs have independent limits
  it("should maintain independent limits for different IPs", () => {
    fc.assert(
      fc.property(
        hexHash(),
        hexHash(),
        (ipHash1, ipHash2) => {
          fc.pre(ipHash1 !== ipHash2); // Ensure different IPs

          const limiter = new RateLimiter({
            test: { maxRequests: 5, windowMs: 60000 },
          });

          // Exhaust limit for first IP
          for (let i = 0; i < 5; i++) {
            limiter.check(ipHash1, "test");
          }

          // First IP should be blocked
          expect(limiter.check(ipHash1, "test").allowed).toBe(false);

          // Second IP should still be allowed
          expect(limiter.check(ipHash2, "test").allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Different action types have independent limits
  it("should maintain independent limits for different action types", () => {
    fc.assert(
      fc.property(
        hexHash(),
        (ipHash) => {
          const limiter = new RateLimiter({
            vote: { maxRequests: 3, windowMs: 60000 },
            play: { maxRequests: 5, windowMs: 60000 },
          });

          // Exhaust vote limit
          for (let i = 0; i < 3; i++) {
            limiter.check(ipHash, "vote");
          }

          // Vote should be blocked
          expect(limiter.check(ipHash, "vote").allowed).toBe(false);

          // Play should still be allowed
          expect(limiter.check(ipHash, "play").allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Reset time is in the future when limit is exceeded
  it("should return a future reset time when limit is exceeded", () => {
    fc.assert(
      fc.property(
        hexHash(),
        (ipHash) => {
          const limiter = new RateLimiter({
            test: { maxRequests: 1, windowMs: 60000 },
          });

          // Use up the limit
          limiter.check(ipHash, "test");

          // Check the rejected request
          const result = limiter.check(ipHash, "test");
          const now = Date.now();

          expect(result.allowed).toBe(false);
          expect(result.resetTime).toBeGreaterThan(now);
          expect(result.resetTime).toBeLessThanOrEqual(now + 60000);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Unknown action types are allowed by default
  it("should allow unknown action types by default", () => {
    // Exclude JavaScript reserved property names that could interfere with object operations
    const reservedNames = ["vote", "play", "download", "view", "constructor", "prototype", "__proto__", "toString", "valueOf", "hasOwnProperty"];
    
    fc.assert(
      fc.property(
        hexHash(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !reservedNames.includes(s)),
        (ipHash, unknownAction) => {
          const limiter = new RateLimiter();

          const result = limiter.check(ipHash, unknownAction);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(Infinity);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: social-engagement, Property 7: Hotness Score Calculation Consistency
 * Validates: Requirements 5.1
 * 
 * For any set of engagement metrics (recentPlays, recentVotes, recentComments,
 * recentDownloads, ageHours), the calculated hotness score SHALL follow the
 * defined formula: weighted sum with time decay. Files with higher recent
 * engagement SHALL have higher hotness scores than files with lower engagement
 * (all else being equal).
 */
describe("Hotness Score Calculation Consistency (Property 7)", () => {
  // Arbitrary for generating valid engagement metrics
  const engagementMetrics = () => fc.record({
    recentPlays: fc.integer({ min: 0, max: 10000 }),
    recentVotes: fc.integer({ min: -1000, max: 1000 }), // Can be negative (more downvotes)
    recentComments: fc.integer({ min: 0, max: 1000 }),
    recentDownloads: fc.integer({ min: 0, max: 5000 }),
    ageHours: fc.integer({ min: 0, max: 720 }), // Up to 30 days
  });

  // Property: Score follows the weighted formula
  it("should calculate score using the weighted formula", () => {
    fc.assert(
      fc.property(engagementMetrics(), (metrics) => {
        const score = calculateHotnessScore(metrics);
        
        // Manually calculate expected score
        const rawScore =
          metrics.recentPlays * HOTNESS_WEIGHTS.play +
          metrics.recentVotes * HOTNESS_WEIGHTS.vote +
          metrics.recentComments * HOTNESS_WEIGHTS.comment +
          metrics.recentDownloads * HOTNESS_WEIGHTS.download;
        
        const decayFactor = Math.pow(0.5, metrics.ageHours / HOTNESS_HALF_LIFE_HOURS);
        const expectedScore = Math.round(rawScore * decayFactor * 100);
        
        expect(score).toBe(expectedScore);
      }),
      { numRuns: 100 }
    );
  });

  // Property: Higher plays = higher score (all else equal)
  it("should produce higher scores for more plays (all else equal)", () => {
    fc.assert(
      fc.property(
        fc.record({
          recentPlays: fc.integer({ min: 0, max: 10000 }),
          recentVotes: fc.integer({ min: -1000, max: 1000 }),
          recentComments: fc.integer({ min: 0, max: 1000 }),
          recentDownloads: fc.integer({ min: 0, max: 5000 }),
          ageHours: fc.integer({ min: 0, max: 100 }), // Limit age to avoid extreme decay
        }),
        fc.integer({ min: 1, max: 1000 }), // Additional plays
        (baseMetrics, additionalPlays) => {
          const lowerScore = calculateHotnessScore(baseMetrics);
          const higherMetrics = { ...baseMetrics, recentPlays: baseMetrics.recentPlays + additionalPlays };
          const higherScore = calculateHotnessScore(higherMetrics);
          
          // With limited age, additional plays should always increase score
          expect(higherScore).toBeGreaterThanOrEqual(lowerScore);
          // When there's meaningful additional engagement, score should increase
          if (additionalPlays >= 10) {
            expect(higherScore).toBeGreaterThan(lowerScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Higher votes = higher score (all else equal)
  it("should produce higher scores for more votes (all else equal)", () => {
    fc.assert(
      fc.property(
        fc.record({
          recentPlays: fc.integer({ min: 0, max: 10000 }),
          recentVotes: fc.integer({ min: -1000, max: 1000 }),
          recentComments: fc.integer({ min: 0, max: 1000 }),
          recentDownloads: fc.integer({ min: 0, max: 5000 }),
          ageHours: fc.integer({ min: 0, max: 100 }), // Limit age to avoid extreme decay
        }),
        fc.integer({ min: 1, max: 500 }), // Additional votes
        (baseMetrics, additionalVotes) => {
          const lowerScore = calculateHotnessScore(baseMetrics);
          const higherMetrics = { ...baseMetrics, recentVotes: baseMetrics.recentVotes + additionalVotes };
          const higherScore = calculateHotnessScore(higherMetrics);
          
          // With limited age, additional votes should always increase score
          expect(higherScore).toBeGreaterThanOrEqual(lowerScore);
          // When there's meaningful additional engagement, score should increase
          if (additionalVotes >= 5) {
            expect(higherScore).toBeGreaterThan(lowerScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Older content has lower score (all else equal)
  it("should produce lower scores for older content (all else equal)", () => {
    fc.assert(
      fc.property(
        fc.record({
          recentPlays: fc.integer({ min: 1, max: 10000 }), // At least some engagement
          recentVotes: fc.integer({ min: 0, max: 1000 }),
          recentComments: fc.integer({ min: 0, max: 1000 }),
          recentDownloads: fc.integer({ min: 0, max: 5000 }),
          ageHours: fc.integer({ min: 0, max: 360 }),
        }),
        fc.integer({ min: 1, max: 360 }), // Additional hours
        (baseMetrics, additionalHours) => {
          const newerScore = calculateHotnessScore(baseMetrics);
          const olderMetrics = { ...baseMetrics, ageHours: baseMetrics.ageHours + additionalHours };
          const olderScore = calculateHotnessScore(olderMetrics);
          
          expect(olderScore).toBeLessThan(newerScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Score is non-negative when all engagement is non-negative
  it("should produce non-negative scores when engagement is non-negative", () => {
    fc.assert(
      fc.property(
        fc.record({
          recentPlays: fc.integer({ min: 0, max: 10000 }),
          recentVotes: fc.integer({ min: 0, max: 1000 }), // Non-negative votes
          recentComments: fc.integer({ min: 0, max: 1000 }),
          recentDownloads: fc.integer({ min: 0, max: 5000 }),
          ageHours: fc.integer({ min: 0, max: 720 }),
        }),
        (metrics) => {
          const score = calculateHotnessScore(metrics);
          expect(score).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Zero engagement = zero score
  it("should produce zero score for zero engagement", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 720 }), // Any age
        (ageHours) => {
          const metrics: EngagementMetrics = {
            recentPlays: 0,
            recentVotes: 0,
            recentComments: 0,
            recentDownloads: 0,
            ageHours,
          };
          const score = calculateHotnessScore(metrics);
          expect(score).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Score at half-life is approximately half
  it("should halve the score after one half-life period", () => {
    fc.assert(
      fc.property(
        fc.record({
          recentPlays: fc.integer({ min: 100, max: 10000 }), // Significant engagement
          recentVotes: fc.integer({ min: 0, max: 1000 }),
          recentComments: fc.integer({ min: 0, max: 1000 }),
          recentDownloads: fc.integer({ min: 0, max: 5000 }),
          ageHours: fc.constant(0), // Start at age 0
        }),
        (metrics) => {
          const scoreAtZero = calculateHotnessScore(metrics);
          const scoreAtHalfLife = calculateHotnessScore({
            ...metrics,
            ageHours: HOTNESS_HALF_LIFE_HOURS,
          });
          
          // Score at half-life should be approximately half (within rounding tolerance)
          const expectedHalf = Math.round(scoreAtZero / 2);
          expect(Math.abs(scoreAtHalfLife - expectedHalf)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
