/**
 * Audit Log Sanitizer
 *
 * Handles JSON serialization for audit logs:
 * - Excludes sensitive fields
 * - Handles circular references
 * - Enforces size limits
 * - Excludes relations
 */

export class AuditSanitizer {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'passwordHash',
    'refreshToken',
    'passwordResetToken',
    'apiKey',
    'secret',
  ];

  private static readonly MAX_JSON_SIZE = 10240; // 10KB

  /**
   * Sanitize entity for audit logging
   * @param entity - Entity to sanitize
   * @returns Sanitized object safe for JSON storage
   */
  static sanitizeEntity(entity: any): Record<string, any> | null {
    if (!entity) return null;

    try {
      // First pass: remove sensitive fields and relations
      const sanitized = this.removeSensitiveData(entity);

      // Check size
      const jsonString = JSON.stringify(sanitized);
      if (jsonString.length > this.MAX_JSON_SIZE) {
        return this.truncateLargeObject(sanitized, jsonString.length);
      }

      return sanitized;
    } catch (error) {
      // Handle circular references or other serialization errors
      return {
        _error: 'Failed to serialize entity',
        _reason: error.message,
      };
    }
  }

  /**
   * Remove sensitive fields from object
   */
  private static removeSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();

    // Handle arrays
    if (Array.isArray(obj)) {
      // Exclude arrays (likely relations) - store only count
      return { _arrayLength: obj.length, _note: 'Array excluded from audit' };
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields
      if (this.SENSITIVE_FIELDS.includes(key)) {
        result[key] = '***MASKED***';
        continue;
      }

      // Skip relations (objects that aren't plain objects)
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Check if it's a relation (has an 'id' field and other fields)
        const keys = Object.keys(value);
        if (keys.includes('id') && keys.length > 1) {
          // It's likely a relation, store only the ID
          result[key] = { _relationId: value.id };
          continue;
        }
      }

      // Handle nested objects
      if (value && typeof value === 'object') {
        result[key] = this.removeSensitiveData(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Truncate large object to meet size limits
   */
  private static truncateLargeObject(obj: any, originalSize: number): Record<string, any> {
    return {
      _truncated: true,
      _originalSize: originalSize,
      _fieldCount: Object.keys(obj).length,
      _note: 'Object exceeds 10KB limit, truncated for storage',
      _summary: this.getSummary(obj),
    };
  }

  /**
   * Get summary of object for truncated logs
   */
  private static getSummary(obj: any): Record<string, any> {
    const summary: Record<string, any> = {};
    const keys = Object.keys(obj);

    // Include key fields if present
    const keyFields = ['id', 'code', 'name', 'invoiceNumber', 'prescriptionNumber', 'status'];
    for (const field of keyFields) {
      if (obj[field]) {
        summary[field] = obj[field];
      }
    }

    summary._totalFields = keys.length;
    return summary;
  }

  /**
   * Mask sensitive fields in object
   * Used for displaying audit logs to users without full permissions
   */
  static maskSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = { ...obj };

    for (const field of this.SENSITIVE_FIELDS) {
      if (masked[field]) {
        masked[field] = '***MASKED***';
      }
    }

    return masked;
  }
}
