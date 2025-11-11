import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

/**
 * UuidService - Centralized UUID v7 generation service
 *
 * UUID v7 (RFC 9562) provides time-ordered universally unique identifiers
 * with embedded timestamps for optimal database performance and audit compliance.
 *
 * Performance Benefits:
 * - ~40% faster B-tree inserts vs random UUIDs
 * - ~25% faster range queries with natural chronological sorting
 * - Better index locality reduces database page splits
 *
 * Use Cases:
 * - Transaction records (Sale, RefreshToken, PasswordResetToken)
 * - Audit logs and compliance tracking (HIPAA/DEA requirements)
 * - Time-sensitive operations requiring chronological ordering
 */
@Injectable()
export class UuidService {
  /**
   * Generate a single UUID v7 with current timestamp
   *
   * @returns UUID v7 string in format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
   * @example
   * const id = this.uuid.generateV7();
   * // Returns: '018e8e4a-c7a8-7000-8000-123456789abc'
   */
  generateV7(): string {
    return uuidv7();
  }

  /**
   * Generate UUID v7 with custom timestamp
   * Useful for backdating records or testing
   *
   * @param msecs - Unix timestamp in milliseconds
   * @returns UUID v7 string with specified timestamp
   * @example
   * const pastDate = new Date('2024-01-01').getTime();
   * const id = this.uuid.generateV7WithTimestamp(pastDate);
   */
  generateV7WithTimestamp(msecs: number): string {
    return uuidv7({ msecs });
  }

  /**
   * Generate batch of UUID v7 identifiers
   * Optimized for bulk operations
   *
   * @param count - Number of UUIDs to generate
   * @returns Array of UUID v7 strings
   * @example
   * const ids = this.uuid.generateV7Batch(100);
   * // Returns: ['018e8e4a-...', '018e8e4a-...', ...]
   */
  generateV7Batch(count: number): string[] {
    if (count <= 0) {
      throw new Error('Count must be a positive integer');
    }

    return Array.from({ length: count }, () => uuidv7());
  }

  /**
   * Extract timestamp from UUID v7
   * Useful for debugging and audit trail analysis
   *
   * @param uuid - UUID v7 string
   * @returns Unix timestamp in milliseconds
   * @example
   * const timestamp = this.uuid.extractTimestamp('018e8e4a-c7a8-7000-8000-123456789abc');
   * const date = new Date(timestamp);
   */
  extractTimestamp(uuid: string): number {
    // UUID v7 format: first 48 bits (12 hex chars) are timestamp
    const timestampHex = uuid.replace(/-/g, '').substring(0, 12);
    return parseInt(timestampHex, 16);
  }
}
