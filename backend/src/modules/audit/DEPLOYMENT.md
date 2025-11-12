# Audit Module Deployment Guide

## Prerequisites

- PostgreSQL 14+
- NestJS application running
- Prisma migrations set up
- Required npm packages installed

## Deployment Steps

### Step 1: Install Dependencies

```bash
# Already included in package.json
npm install
```

### Step 2: Update Database Schema

```bash
# Generate Prisma client with updated schema
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_audit_enhancements

# Or apply specific migration
psql -U your_user -d your_database -f prisma/migrations/add_audit_enhancements/migration.sql
```

### Step 3: Verify Database Triggers

Connect to your database and verify triggers are in place:

```sql
-- Check if trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'prevent_audit_modification';

-- Check if triggers exist
SELECT tgname FROM pg_trigger WHERE tgrelid = 'AuditLog'::regclass;

-- Expected output:
-- audit_log_immutable_update
-- audit_log_immutable_delete
```

### Step 4: Configure Environment Variables

Add to `.env` file:

```env
# Audit Configuration
AUDIT_RETENTION_YEARS=7
AUDIT_ASYNC_LOGGING=true
AUDIT_MAX_JSON_SIZE=10240
AUDIT_ENABLE_PERFORMANCE_MONITORING=true
AUDIT_ALERT_ON_FAILURE=true

# Export Configuration
AUDIT_EXPORT_MAX_RECORDS=100000
AUDIT_EXPORT_FORMATS=csv,json
```

### Step 5: Register Audit Module

In `app.module.ts`:

```typescript
import { AuditModule } from './modules/audit/audit.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // ... other modules
    ScheduleModule.forRoot(), // Required for retention job
    AuditModule,
  ],
})
export class AppModule {}
```

### Step 6: Apply Auditing to Controllers

Add `@Auditable()` decorator to controllers:

```typescript
import { Auditable, AuditLogInterceptor } from '@/modules/audit';

@Auditable('Product')
@UseInterceptors(AuditLogInterceptor)
@Controller('products')
export class ProductController {
  // ... controller methods
}
```

**High-priority entities to audit:**
1. ProductController → `@Auditable('Product')`
2. SaleController → `@Auditable('Sale')`
3. PrescriptionController → `@Auditable('Prescription')`
4. StockAdjustmentController → `@Auditable('StockAdjustment')`
5. UserController → `@Auditable('User')`
6. TenantController → `@Auditable('Tenant')`

### Step 7: Verify Deployment

#### Test Audit Logging

```bash
# Make a request to create a product
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Product", "price": 100}'

# Query audit logs
curl -X GET "http://localhost:3000/audit?entityType=Product" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test Immutability

Connect to database:

```sql
-- Try to update an audit log (should fail)
UPDATE "AuditLog" SET "entityType" = 'Modified' WHERE id = 'some-id';
-- Expected: ERROR: Audit logs are immutable

-- Try to delete an audit log (should fail)
DELETE FROM "AuditLog" WHERE id = 'some-id';
-- Expected: ERROR: Audit logs are immutable
```

#### Test Retention Job

```typescript
// In a test file or admin endpoint
import { AuditRetentionJob } from '@/modules/audit';

// Manually trigger retention job
await retentionJob.handleRetentionPolicy();
```

### Step 8: Monitoring Setup

#### Application Metrics

Set up metrics collection (Prometheus example):

```typescript
import { Counter, Histogram } from 'prom-client';

// Define metrics
const auditLogsCreated = new Counter({
  name: 'audit_logs_created_total',
  help: 'Total number of audit logs created',
  labelNames: ['entityType', 'action'],
});

const auditLoggingDuration = new Histogram({
  name: 'audit_logging_duration_seconds',
  help: 'Duration of audit logging operations',
  labelNames: ['entityType'],
});
```

#### Database Monitoring

```sql
-- Monitor audit log table size
SELECT
  pg_size_pretty(pg_total_relation_size('AuditLog')) as total_size,
  pg_size_pretty(pg_relation_size('AuditLog')) as table_size,
  pg_size_pretty(pg_indexes_size('AuditLog')) as indexes_size;

-- Monitor record counts
SELECT
  COUNT(*) as total_logs,
  COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as active_logs,
  COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as archived_logs
FROM "AuditLog";

-- Monitor audit log growth rate
SELECT
  DATE("createdAt") as date,
  COUNT(*) as logs_per_day
FROM "AuditLog"
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE("createdAt")
ORDER BY date DESC;
```

#### Alerting Rules

Set up alerts for:
- Audit logging failure rate > 5%
- Audit query duration > 500ms (p95)
- Audit log storage growth > 10GB/day
- Retention job failures

### Step 9: Performance Tuning

#### Database Optimization

```sql
-- Analyze table for query optimization
ANALYZE "AuditLog";

-- Vacuum table to reclaim space
VACUUM ANALYZE "AuditLog";

-- Consider partitioning for large datasets (optional)
-- This is for future optimization when table grows very large
```

#### Application Optimization

1. **Enable async logging** (recommended):
   - Set `AUDIT_ASYNC_LOGGING=true`
   - Prevents blocking of business operations

2. **Adjust JSON size limit** if needed:
   - Default: 10KB
   - Increase only if necessary

3. **Monitor performance**:
   - Track audit logging overhead
   - Target: < 10ms per operation

### Step 10: Security Verification

#### Access Control

Verify only authorized roles can access audit logs:

```bash
# As ADMIN (should succeed)
curl -X GET http://localhost:3000/audit \
  -H "Authorization: Bearer ADMIN_TOKEN"

# As CASHIER (should fail with 403)
curl -X GET http://localhost:3000/audit \
  -H "Authorization: Bearer CASHIER_TOKEN"
```

#### Multi-Tenant Isolation

Verify tenant isolation:

```sql
-- Check that each tenant can only see their own logs
SELECT DISTINCT "tenantId" FROM "AuditLog";

-- Verify no cross-tenant queries succeed
```

## Post-Deployment Checklist

- [ ] Database migration applied successfully
- [ ] Triggers created and verified
- [ ] Environment variables configured
- [ ] Audit module registered in app.module.ts
- [ ] @Auditable decorator applied to controllers
- [ ] Test audit log creation works
- [ ] Test immutability enforcement works
- [ ] Test retention job runs successfully
- [ ] Monitoring and alerting configured
- [ ] Access control verified
- [ ] Multi-tenant isolation verified
- [ ] Performance benchmarks met
- [ ] Documentation updated

## Rollback Procedure

If deployment fails:

### 1. Remove Triggers

```sql
DROP TRIGGER IF EXISTS audit_log_immutable_update ON "AuditLog";
DROP TRIGGER IF EXISTS audit_log_immutable_delete ON "AuditLog";
DROP FUNCTION IF EXISTS prevent_audit_modification();
```

### 2. Rollback Migration

```bash
# Prisma rollback
npx prisma migrate resolve --rolled-back add_audit_enhancements

# Or manual rollback
psql -U your_user -d your_database -f prisma/migrations/add_audit_enhancements/rollback.sql
```

### 3. Remove Module Registration

Remove `AuditModule` from `app.module.ts`.

### 4. Remove Decorators

Remove `@Auditable()` decorators from controllers.

## Troubleshooting

### Issue: Triggers not working

**Solution:**
```sql
-- Recreate triggers
DROP TRIGGER IF EXISTS audit_log_immutable_update ON "AuditLog";
CREATE TRIGGER audit_log_immutable_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
WHEN (OLD.deletedAt IS NULL)
EXECUTE FUNCTION prevent_audit_modification();
```

### Issue: Audit logs not created

**Checklist:**
1. Is `@Auditable()` decorator applied?
2. Is `AuditLogInterceptor` registered?
3. Check application logs for errors
4. Verify PrismaService is available

### Issue: Performance degradation

**Solutions:**
1. Enable async logging: `AUDIT_ASYNC_LOGGING=true`
2. Check database indexes exist
3. Run `VACUUM ANALYZE "AuditLog"`
4. Consider table partitioning

### Issue: Retention job not running

**Solutions:**
1. Verify `ScheduleModule.forRoot()` is imported
2. Check logs for cron job execution
3. Manually trigger: `await retentionJob.handleRetentionPolicy()`

## Support

For issues or questions:
- Check logs: `tail -f logs/application.log`
- Check database: `psql -U your_user -d your_database`
- Review documentation: `/src/modules/audit/README.md`
- Contact: [System Administrator]

---

**Deployment Version**: 1.0
**Last Updated**: 2025-01-12
**Requires**: PostgreSQL 14+, NestJS 10+, Prisma 5+
