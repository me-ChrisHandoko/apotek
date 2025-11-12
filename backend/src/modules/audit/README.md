# Audit & Compliance Module

**Phase 6 Implementation** - Comprehensive audit logging system for regulatory compliance and operational transparency.

## Overview

This module provides automatic audit logging for all CREATE/UPDATE/DELETE operations on critical entities. It ensures compliance with DEA, HIPAA, and Pharmacy Board requirements through immutable, traceable audit trails.

## Features

### Core Capabilities

- ✅ **Automatic Audit Logging**: Interceptor-based automatic logging for all CRUD operations
- ✅ **Multi-Tenant Isolation**: Tenant-scoped audit logs with cross-tenant access prevention
- ✅ **Immutable Logs**: Database-enforced immutability via PostgreSQL triggers
- ✅ **Comprehensive Tracking**: User, tenant, IP address, timestamp, old/new values
- ✅ **Advanced Querying**: Filter by entity type, action, user, date range, IP address
- ✅ **Export Functionality**: CSV, JSON export for regulatory submissions
- ✅ **Retention Policy**: Automated 7-year retention with soft delete
- ✅ **Access Control**: Role-based access (ADMIN, MANAGER only)

### Compliance Features

- **DEA Compliance**: Controlled substance tracking with 2+ year retention
- **HIPAA Ready**: Patient data access logging with sensitive field masking
- **Pharmacy Board**: Complete prescription and inventory audit trails
- **Immutability**: Append-only logs enforced at database level
- **Export for Audits**: CSV/JSON export for regulatory submissions

## Architecture

### Components

```
src/modules/audit/
├── audit.service.ts              # Core audit operations
├── audit.controller.ts           # REST API endpoints
├── audit.module.ts               # Module definition
├── dto/
│   ├── audit-query.dto.ts        # Query filters
│   └── create-audit.dto.ts       # Manual logging
├── interceptors/
│   └── audit-log.interceptor.ts  # Automatic logging
├── guards/
│   └── audit-access.guard.ts     # Role-based access control
├── utils/
│   ├── sanitizer.ts              # JSON sanitization
│   └── export.service.ts         # CSV/JSON export
└── jobs/
    └── retention.job.ts          # Retention policy scheduler
```

### Database Schema

```prisma
model AuditLog {
  id         String      @id @default(cuid())
  tenantId   String
  userId     String
  entityType String      # e.g., "Product", "Sale"
  entityId   String
  action     AuditAction # CREATE, UPDATE, DELETE
  oldValues  Json?       # Before state
  newValues  Json?       # After state
  metadata   Json?       # Additional context
  ipAddress  String?
  createdAt  DateTime    @default(now())
  deletedAt  DateTime?   # Soft delete for retention

  tenant Tenant @relation(...)
  user   User   @relation(...)

  @@index([tenantId])
  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([deletedAt])
}
```

## Usage

### Automatic Auditing (Recommended)

Apply `@Auditable()` decorator to controllers:

```typescript
import { Auditable } from '@/modules/audit/interceptors/audit-log.interceptor';

@Auditable('Product')
@Controller('products')
export class ProductController {
  @Post()
  async create(@Body() dto: CreateProductDto) {
    // Automatically audited
    return this.productService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    // Automatically audited with before/after values
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Automatically audited
    return this.productService.remove(id);
  }
}
```

### Manual Auditing

For background jobs or custom scenarios:

```typescript
import { AuditService } from '@/modules/audit/audit.service';
import { AuditAction } from '@/modules/audit/dto/audit-query.dto';

@Injectable()
export class MyService {
  constructor(private readonly auditService: AuditService) {}

  async processBackgroundJob() {
    // ... perform operation

    // Log manually
    await this.auditService.logAction({
      tenantId: 'tenant-1',
      userId: 'SYSTEM',
      entityType: 'ProductBatch',
      entityId: batch.id,
      action: AuditAction.UPDATE,
      oldValues: { isActive: true },
      newValues: { isActive: false },
      ipAddress: 'CRON_JOB',
      metadata: {
        reason: 'Expired batch auto-deactivation',
        expiryDate: batch.expiryDate,
      },
    });
  }
}
```

### Querying Audit Logs

```typescript
// Query with filters
const result = await auditService.findAll({
  tenantId: 'tenant-1',
  entityType: 'Product',
  action: AuditAction.UPDATE,
  dateFrom: '2024-01-01',
  dateTo: '2024-12-31',
  page: 1,
  limit: 50,
});

// Get entity audit trail
const trail = await auditService.getEntityAuditTrail(
  'Product',
  'product-123',
  'tenant-1',
);

// Get statistics
const stats = await auditService.getStatistics('tenant-1', 30);
```

### Export Functionality

```typescript
import { ExportService } from '@/modules/audit/utils/export.service';

// Export to CSV
const csv = await exportService.exportToCSV(logs);

// Export to JSON
const json = await exportService.exportToJSON(logs);

// Generate summary
const summary = exportService.generateSummary(logs);
```

## API Endpoints

### GET /audit

Query audit logs with filters.

**Query Parameters:**
- `tenantId`: Tenant filter (auto-applied)
- `entityType`: Entity type (e.g., "Product", "Sale")
- `entityId`: Specific entity ID
- `userId`: User who made changes
- `action`: CREATE, UPDATE, DELETE
- `dateFrom`: Start date (ISO 8601)
- `dateTo`: End date (ISO 8601)
- `ipAddress`: IP filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 200)

**Response:**
```json
{
  "data": [
    {
      "id": "audit-1",
      "tenantId": "tenant-1",
      "userId": "user-1",
      "entityType": "Product",
      "entityId": "product-123",
      "action": "UPDATE",
      "oldValues": { "price": 100 },
      "newValues": { "price": 120 },
      "ipAddress": "192.168.1.1",
      "createdAt": "2024-01-15T10:30:00Z",
      "user": {
        "username": "admin",
        "fullName": "Admin User",
        "role": "ADMIN"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

### GET /audit/statistics

Get audit statistics for the last 30 days.

### GET /audit/:id

Get specific audit log by ID.

### GET /audit/entity/:entityType/:entityId

Get complete audit trail for an entity.

## Configuration

### Environment Variables

```env
# Retention policy (years)
AUDIT_RETENTION_YEARS=7

# Enable async logging (recommended)
AUDIT_ASYNC_LOGGING=true

# Maximum JSON size (bytes)
AUDIT_MAX_JSON_SIZE=10240
```

## Security

### Access Control

- **ADMIN**: Full audit log access for their tenant
- **MANAGER**: Full audit log access for their tenant
- **PHARMACIST**: Limited access (own actions only)
- **CASHIER**: No access

### Data Protection

- **Sensitive fields masked**: password, refreshToken, apiKey
- **Tenant isolation enforced**: Cross-tenant access prevented
- **Immutability**: Database triggers prevent modification/deletion
- **JSON size limits**: Prevents storage abuse

### Compliance

- **DEA**: 2+ year retention, controlled substance tracking
- **HIPAA**: Patient data access logging
- **Pharmacy Board**: Complete prescription audit trail

## Performance

### Optimization Strategies

- **Async Logging**: Non-blocking audit operations
- **Indexed Queries**: Fast filtering by tenant, entity, date
- **Pagination**: Efficient data retrieval
- **JSON Sanitization**: Excludes relations, limits size

### Performance Targets

- Audit overhead: < 10ms per operation
- Query performance: < 200ms with filters
- No blocking of business operations
- Handles 10,000+ audit logs/hour

## Testing

### Run Unit Tests

```bash
npm run test -- audit.service.spec.ts
```

### Run Integration Tests

```bash
npm run test:e2e -- audit.integration.spec.ts
```

## Maintenance

### Retention Policy

Scheduled job runs monthly (1st at midnight):
- Archives logs older than 7 years
- Soft delete (sets `deletedAt`)
- Preserves data for compliance

### Manual Operations

```typescript
// Manual retention execution
await retentionJob.manualRetentionExecution(5); // Archive logs older than 5 years

// Permanent deletion (use with caution)
await retentionJob.permanentlyDeleteArchivedLogs(1); // Delete logs archived for 1+ year
```

## Troubleshooting

### Audit logs not created

1. Check interceptor is applied: `@Auditable('EntityType')`
2. Verify method name matches pattern: `create`, `update`, `delete`
3. Check logs for errors (audit failures are logged, not thrown)

### Cross-tenant data leakage

1. Verify tenant middleware populates `request.tenant`
2. Check guards are applied to audit controller
3. Verify tenant filter in queries

### Performance issues

1. Enable async logging: `AUDIT_ASYNC_LOGGING=true`
2. Check database indexes are present
3. Monitor audit log table size
4. Consider table partitioning for large datasets

## References

- [Implementation Plan](../../../docs/core-modules/implementation-plan.md#phase-6-audit--compliance)
- [Schema Documentation](../../../prisma/schema.prisma)
- DEA Compliance: 21 CFR Part 1304
- HIPAA Compliance: 45 CFR § 164.312

---

**Version**: 1.0
**Phase**: 6 (Audit & Compliance)
**Status**: Production Ready
**Last Updated**: 2025-01-12
