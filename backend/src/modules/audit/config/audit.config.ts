/**
 * Audit Module Configuration
 *
 * Centralized configuration for audit module settings
 */

export const auditConfig = {
  /**
   * Retention policy (years)
   * Default: 7 years (recommended)
   * Minimum: 2 years (DEA requirement for controlled substances)
   */
  retentionYears: parseInt(process.env.AUDIT_RETENTION_YEARS || '7', 10),

  /**
   * Enable async logging (non-blocking)
   * Recommended: true for production
   */
  asyncLogging: process.env.AUDIT_ASYNC_LOGGING !== 'false',

  /**
   * Maximum JSON size for oldValues/newValues (bytes)
   * Default: 10KB
   */
  maxJsonSize: parseInt(process.env.AUDIT_MAX_JSON_SIZE || '10240', 10),

  /**
   * Sensitive fields to mask in audit logs
   */
  sensitiveFields: [
    'password',
    'passwordHash',
    'refreshToken',
    'passwordResetToken',
    'apiKey',
    'secret',
  ],

  /**
   * Entities requiring audit logging
   */
  auditableEntities: [
    'Product', // Controlled substances tracking
    'Sale', // Financial audit
    'SaleItem', // Transaction details
    'Prescription', // DEA compliance
    'PrescriptionItem', // Dispensing records
    'ProductBatch', // Inventory tracking
    'StockAdjustment', // Loss/theft tracking
    'User', // Access control
    'Tenant', // Configuration security
  ],

  /**
   * Fields to exclude from audit log serialization
   */
  excludeFields: [
    'password',
    'passwordHash',
    'refreshToken',
    'passwordResetToken',
    'apiKey',
    'secret',
  ],

  /**
   * Enable performance monitoring
   */
  enablePerformanceMonitoring: process.env.AUDIT_ENABLE_PERFORMANCE_MONITORING === 'true',

  /**
   * Alert on audit failures
   */
  alertOnFailure: process.env.AUDIT_ALERT_ON_FAILURE !== 'false',

  /**
   * Export configuration
   */
  export: {
    maxRecords: parseInt(process.env.AUDIT_EXPORT_MAX_RECORDS || '100000', 10),
    formats: (process.env.AUDIT_EXPORT_FORMATS || 'csv,json').split(','),
  },
};

/**
 * Validate audit configuration
 */
export function validateAuditConfig(): void {
  if (auditConfig.retentionYears < 2) {
    console.warn(
      '⚠️  WARNING: Audit retention period is less than 2 years. DEA requires minimum 2-year retention for controlled substances.',
    );
  }

  if (auditConfig.retentionYears < 7) {
    console.warn(
      '⚠️  WARNING: Audit retention period is less than 7 years. Recommended retention is 7 years for pharmacy operations.',
    );
  }

  if (auditConfig.maxJsonSize > 102400) {
    // 100KB
    console.warn(
      '⚠️  WARNING: Maximum JSON size is very large. This may impact database performance.',
    );
  }

  console.log('✅ Audit configuration validated:');
  console.log(`   - Retention: ${auditConfig.retentionYears} years`);
  console.log(`   - Async Logging: ${auditConfig.asyncLogging ? 'enabled' : 'disabled'}`);
  console.log(`   - Max JSON Size: ${auditConfig.maxJsonSize} bytes`);
  console.log(`   - Auditable Entities: ${auditConfig.auditableEntities.length}`);
}
