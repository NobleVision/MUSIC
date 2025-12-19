import { createHash } from "crypto";
import { nanoid } from "nanoid";

/**
 * Simple password hashing using SHA-256
 * For production, consider using bcrypt or argon2
 */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return nanoid(length);
}

/**
 * Generate API key
 */
export function generateApiKey(): string {
  return `mk_${nanoid(48)}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}
