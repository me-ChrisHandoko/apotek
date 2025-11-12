# Phase 5: Reporting & Analytics - Comprehensive Requirements Analysis

**Analysis Date**: 2025-01-12
**Phase Timeline**: Weeks 15-17 (Estimated: 2.5 weeks)
**Priority**: Medium
**Status**: Requirements Analysis Complete - DO NOT IMPLEMENT YET

---

## Executive Summary

Phase 5 implements the Reporting & Analytics module for the Pharmacy Management System. This analysis reveals that the module is **more complex than initially estimated** and has **critical dependencies** that must be addressed before implementation.

### Key Findings

⚠️ **CRITICAL ISSUES IDENTIFIED**:
1. **Timeline Underestimated**: Realistic estimate is 4 weeks, not 2.5 weeks
2. **Phase Sequencing Problem**: Compliance reports depend on Phase 6 (Audit module)
3. **Missing Specifications**: Authorization matrix, timezone strategy, export requirements
4. **Performance Risks**: Complex aggregations on large datasets without optimization strategy
5. **Schema Gaps**: No "last movement date" for dead stock reporting

✅ **STRENGTHS**:
- Well-structured module organization
- Comprehensive report coverage across all domains
- Clear separation of concerns (4 specialized services)
- Proper dependency on completed operational modules

---

## 1. Module Structure Analysis

### 1.1 Proposed Architecture

```
src/modules/reporting/
├── reporting.controller.ts          # Main API endpoints
├── reporting.service.ts              # Orchestration service
├── reporting.module.ts
├── common/                           # ⚠️ MISSING IN PLAN
│   ├── base-report.service.ts       # Base class with common logic
│   ├── report-cache.service.ts      # Redis caching layer
│   └── report-utils.ts              # Date handling, formatting
├── dto/                              # ⚠️ NEEDS EXPANSION
│   ├── report-filter.dto.ts         # Common filter params
│   ├── date-range.dto.ts            # Date range validation
│   ├── pagination.dto.ts            # Pagination params
│   └── report-response.dto.ts       # Standard response format
├── guards/                           # ⚠️ MISSING IN PLAN
│   └── report-access.guard.ts       # Role-based authorization
└── reports/
    ├── sales-report.service.ts
    ├── inventory-report.service.ts
    ├── expiry-report.service.ts     # ⚠️ MISSING IN PLAN
    └── financial-report.service.ts
```

### 1.2 Architectural Recommendations

**MUST ADD**:
1. **Common Infrastructure Layer**: Base services, DTOs, utilities for code reuse
2. **Authorization Guards**: Report-specific access control
3. **Caching Layer**: Redis integration for performance
4. **Export Services**: If Excel/PDF export is required

**DESIGN PATTERN**: Service-per-domain with shared base functionality

---

## 2. Report Types Detailed Analysis

### 2.1 Sales Reports (6 Types)

| Report Type | Complexity | Data Sources | Key Challenges |
|-------------|------------|--------------|----------------|
| Daily/Weekly/Monthly Summary | LOW | Sale | Date grouping, timezone handling |
| Sales by Product | MEDIUM | Sale → SaleItem → Product | Multi-table joins, product name lookup |
| Sales by Customer | MEDIUM | Sale → Customer | Customer anonymization for privacy |
| Sales by Payment Method | LOW | Sale | Enum aggregation |
| Sales by User (Cashier) | MEDIUM | Sale → User | Performance metrics calculation |
| Top-Selling Products | HIGH | SaleItem → Product | Ranking, quantity aggregation, ties handling |

**Critical Considerations**:
- **Cancelled/Returned Sales**: Should they be included? Need explicit specification
- **Date Ranges**: Default to last 30 days if not specified (performance)
- **Customer Privacy**: Consider masking customer names in some reports
- **Performance**: Sales table can grow to millions of records, needs indexing + caching

### 2.2 Inventory Reports (5 Types)

| Report Type | Complexity | Data Sources | Key Challenges |
|-------------|------------|--------------|----------------|
| Current Stock Levels | MEDIUM | ProductBatch → Product | Aggregation across active batches |
| Low Stock Alerts | MEDIUM | ProductBatch → Product | Compare against minStockLevel |
| Expiry Report | LOW | ProductBatch | Date filtering (30/60/90 days) |
| Dead Stock Report | **VERY HIGH** | Product + SaleItem + StockAdjustment | ⚠️ **SCHEMA GAP** |
| Stock Valuation | MEDIUM | ProductBatch → Product | costPrice * quantity calculation |

**Critical Issue - Dead Stock Report**:
```sql
-- Requires finding products with no movement in X days
-- Schema doesn't track "lastMovementDate"
-- Must query SaleItem and StockAdjustment for each product
-- Can be VERY expensive query (full table scans)

RECOMMENDATION:
- Add lastMovementDate to ProductBatch table (updated by triggers)
- OR implement as background job with cached results
- OR limit query to specific date range with warning
```

**Expiry Date Thresholds**: Need configurable alerts (30, 60, 90 days)

### 2.3 Financial Reports (4 Types)

| Report Type | Complexity | Data Sources | Key Challenges |
|-------------|------------|--------------|----------------|
| Revenue Summary | LOW | Sale | Simple aggregation |
| Profit/Loss by Product | **VERY HIGH** | Sale → SaleItem → ProductBatch | Cost tracking complexity |
| Payment Collection | LOW | Sale | Group by paymentMethod |
| Outstanding Payments | MEDIUM | Sale | ⚠️ **SCHEMA ASSUMPTION** |

**Critical Issue - Profit/Loss Calculation**:
```typescript
// Complex calculation required:
// Profit = (SalePrice - CostPrice) * Quantity

// Challenge: Need to match SaleItem to correct ProductBatch
// to get accurate costPrice (FEFO logic was used during sale)

// Each SaleItem must store batchId to track cost basis
// Verify: Does SaleItem have batchId foreign key?
// (Not explicitly shown in plan's schema overview)
```

**Outstanding Payments Assumption**:
- Plan assumes `Sale.paidAmount < Sale.totalAmount` = outstanding
- Verify this is the intended credit sales tracking mechanism
- Consider: Should there be an InvoicePayment table for payment tracking?

### 2.4 Compliance Reports (3 Types)

| Report Type | Complexity | Data Sources | Key Challenges |
|-------------|------------|--------------|----------------|
| Controlled Substance Log | **VERY HIGH** | Sale → SaleItem → Product + Prescription | DEA format compliance |
| Prescription Audit Log | HIGH | AuditLog (Prescription) | ⚠️ **DEPENDS ON PHASE 6** |
| User Activity Report | MEDIUM | AuditLog | JSON parsing, filtering |

**CRITICAL SEQUENCING ISSUE**:
```
Phase 5: Weeks 15-17 (Reporting)
Phase 6: Weeks 18-19 (Audit Logging)

Problem: Compliance reports need AuditLog from Phase 6
Solution Options:
1. Defer compliance reports to Phase 6
2. Implement audit logging in Phase 5 (earlier)
3. Accept partial compliance reporting in Phase 5
```

**DEA Controlled Substance Requirements**:
- Must include: Date, patient name, prescriber, drug name/strength, quantity, DEA schedule
- Format must match DEA reporting standards (not just data dump)
- Retention: 2+ years for Schedule III-V, longer for Schedule II
- **RECOMMENDATION**: Consult regulatory expert for exact format requirements

---

## 3. Technical Dependencies

### 3.1 Module Dependencies

```
Phase 5 (Reporting) depends on:
├── Phase 1: Auth & Tenant (JWT, tenantId context)
├── Phase 2: Products, Customers, Suppliers (master data)
├── Phase 3: Inventory, Prescriptions (operational data)
├── Phase 4: Sales, Purchase Orders (transactional data)
└── Phase 6: Audit Logging (⚠️ REVERSE DEPENDENCY)
```

### 3.2 Database Query Patterns

**Simple Queries** (Single table aggregation):
```sql
-- Daily sales summary
SELECT DATE(saleDate), SUM(totalAmount)
FROM Sale
WHERE tenantId = ? AND saleDate BETWEEN ? AND ?
GROUP BY DATE(saleDate)
```

**Complex Queries** (Multiple joins + aggregations):
```sql
-- Profit/loss by product (EXPENSIVE)
SELECT
  p.name,
  SUM(si.quantity) as totalSold,
  SUM(si.subtotal) as revenue,
  SUM(si.quantity * pb.costPrice) as cost,
  SUM(si.subtotal - si.quantity * pb.costPrice) as profit
FROM SaleItem si
JOIN Product p ON si.productId = p.id
JOIN ProductBatch pb ON si.batchId = pb.id  -- ⚠️ Verify batchId exists
JOIN Sale s ON si.saleId = s.id
WHERE s.tenantId = ? AND s.saleDate BETWEEN ? AND ?
GROUP BY p.id, p.name
ORDER BY profit DESC
```

**Very Complex Queries** (Subqueries + window functions):
```sql
-- Dead stock report (VERY EXPENSIVE)
SELECT
  p.id,
  p.name,
  p.code,
  COALESCE(last_sale.date, last_adj.date) as lastMovement,
  CURRENT_DATE - COALESCE(last_sale.date, last_adj.date) as daysSinceMovement
FROM Product p
LEFT JOIN (
  SELECT si.productId, MAX(s.saleDate) as date
  FROM SaleItem si
  JOIN Sale s ON si.saleId = s.id
  WHERE s.tenantId = ?
  GROUP BY si.productId
) last_sale ON p.id = last_sale.productId
LEFT JOIN (
  SELECT sa.productId, MAX(sa.adjustmentDate) as date
  FROM StockAdjustment sa
  WHERE sa.tenantId = ?
  GROUP BY sa.productId
) last_adj ON p.id = last_adj.productId
WHERE p.tenantId = ?
HAVING daysSinceMovement > ?  -- e.g., 90 days
```

### 3.3 Performance Optimization Requirements

**MUST IMPLEMENT**:
1. **Composite Indexes**:
   ```sql
   CREATE INDEX idx_sale_tenant_date ON Sale(tenantId, saleDate);
   CREATE INDEX idx_saleitem_product ON SaleItem(productId, saleId);
   CREATE INDEX idx_productbatch_expiry ON ProductBatch(expiryDate, tenantId);
   CREATE INDEX idx_auditlog_entity ON AuditLog(entityType, entityId, tenantId);
   ```

2. **Redis Caching**:
   ```typescript
   // Cache key pattern: report:{tenantId}:{reportType}:{hash(params)}
   // TTL strategy:
   // - Operational reports (current stock): 5 minutes
   // - Analytical reports (monthly sales): 1 hour
   // - Compliance reports: 15 minutes
   ```

3. **Query Timeouts**:
   ```typescript
   // Default: 30 seconds
   // Complex reports: 60 seconds
   // Background jobs: 300 seconds
   ```

4. **Pagination**:
   ```typescript
   // Use cursor-based pagination for large result sets
   // Default page size: 50 records
   // Maximum page size: 500 records
   ```

---

## 4. Security & Authorization

### 4.1 Role-Based Access Matrix

**⚠️ MISSING IN PLAN - MUST BE DEFINED**

Recommended authorization matrix:

| Report Category | ADMIN | MANAGER | PHARMACIST | CASHIER |
|-----------------|-------|---------|------------|---------|
| Sales Summary | ✅ | ✅ | ❌ | Own only |
| Sales by Product | ✅ | ✅ | ❌ | ❌ |
| Sales by Customer | ✅ | ✅ | ❌ | ❌ |
| Top-Selling Products | ✅ | ✅ | ❌ | ❌ |
| Current Stock | ✅ | ✅ | ✅ | ❌ |
| Low Stock Alerts | ✅ | ✅ | ✅ | ❌ |
| Expiry Report | ✅ | ✅ | ✅ | ❌ |
| Revenue Summary | ✅ | ✅ | ❌ | ❌ |
| Profit/Loss | ✅ | ✅ | ❌ | ❌ |
| Controlled Substance | ✅ | ✅ | ✅ | ❌ |
| Prescription Audit | ✅ | ✅ | ✅ | ❌ |
| User Activity | ✅ | Own only | ❌ | ❌ |

### 4.2 Security Requirements

**CRITICAL**:
1. **Tenant Isolation**:
   ```typescript
   // EVERY query MUST include tenantId filter
   // NO EXCEPTIONS

   // Example guard:
   const validateTenantId = (query: any, userTenantId: string) => {
     if (!query.where.tenantId || query.where.tenantId !== userTenantId) {
       throw new ForbiddenException('Invalid tenant access');
     }
   };
   ```

2. **Report Access Audit Logging**:
   ```typescript
   // Log every report access:
   await auditLog.create({
     action: 'REPORT_ACCESS',
     entityType: 'REPORT',
     entityId: reportType,
     userId: currentUser.id,
     tenantId: currentUser.tenantId,
     ipAddress: request.ip,
     metadata: { filters, dateRange }
   });
   ```

3. **Data Masking** (for sensitive reports):
   ```typescript
   // Customer reports: mask phone, insurance
   customer.phone = maskPhoneNumber(customer.phone); // (555) ***-****
   customer.insuranceNumber = maskInsurance(customer.insuranceNumber); // ****-1234
   ```

4. **Rate Limiting**:
   ```typescript
   // Prevent abuse: 10 reports per minute per user
   @UseGuards(ThrottlerGuard)
   @Throttle(10, 60)
   async getReport() { ... }
   ```

### 4.3 Compliance Requirements

**DEA Controlled Substances**:
- Schedule II-V tracking mandatory
- Report format must meet DEA standards
- Retention: 2+ years minimum
- Must include prescription validation proof

**HIPAA Considerations**:
- Customer medical data (allergies, prescriptions) needs protection
- Access logging required for all PHI access
- Encryption at rest and in transit

**Financial Audit**:
- Revenue/profit calculations must be auditable
- Must reconcile with source transactions
- Document calculation methodology

---

## 5. Missing Specifications & Gaps

### 5.1 CRITICAL - Must Define Before Implementation

1. **Authorization Matrix**:
   - Which roles can access which reports?
   - Data filtering per role (e.g., cashier sees only own sales)

2. **Timezone Strategy**:
   - UTC (server time)?
   - Tenant timezone (from Tenant.settings)?
   - User timezone (from request headers)?
   - **IMPACT**: Affects daily/weekly/monthly grouping accuracy

3. **Export Formats**:
   - JSON only (API response)?
   - Excel (XLSX)?
   - PDF?
   - CSV?
   - **IMPACT**: Affects scope and timeline

4. **Performance SLAs**:
   - Target response time? (Recommend: <5 seconds)
   - Maximum query time before timeout? (Recommend: 30 seconds)
   - Acceptable cache staleness? (Recommend: 5 min - 1 hour)

5. **Phase 5/6 Sequencing**:
   - Implement audit logging in Phase 5?
   - OR defer compliance reports to Phase 6?

### 5.2 Schema Gaps

1. **Dead Stock Reporting**:
   ```
   Problem: No lastMovementDate tracked on Product or ProductBatch
   Solution Options:
   A. Add lastMovementDate field (updated via triggers)
   B. Calculate on-demand (expensive)
   C. Background job with cached results
   ```

2. **SaleItem Cost Tracking**:
   ```
   Problem: Unclear if SaleItem.batchId exists for profit/loss calculation
   Solution: Verify schema has SaleItem.batchId foreign key
   ```

3. **Outstanding Payments**:
   ```
   Problem: Sale.paidAmount < totalAmount assumes partial payment support
   Solution: Verify this is the intended credit sales mechanism
   ```

### 5.3 Response Format Standards

**⚠️ MISSING - Must Define**

Recommended standard response format:
```typescript
interface ReportResponse<T> {
  data: T[];
  metadata: {
    reportType: string;
    generatedAt: DateTime;
    filters: {
      dateRange: { from: Date; to: Date };
      tenantId: string;
      // ... other filters
    };
    pagination?: {
      page: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
    };
    aggregates?: {
      total: number;
      average: number;
      // ... report-specific aggregates
    };
  };
}
```

---

## 6. Implementation Recommendations

### 6.1 Revised Timeline & Phasing

**Original Estimate**: 2.5 weeks
**Realistic Estimate**: 4 weeks

**Recommended Sub-Phases**:

**Phase 5A - Infrastructure (Week 15, Days 1-3)**:
- Common infrastructure (base services, DTOs, utils)
- Authorization guards
- Caching layer setup
- Date handling utilities

**Phase 5B - Sales Reports (Week 15, Days 4-5 + Week 16, Days 1-2)**:
- Daily/weekly/monthly summary
- Sales by product
- Sales by customer
- Sales by payment method
- Sales by user (cashier)
- Top-selling products

**Phase 5C - Inventory & Financial (Week 16, Days 3-5 + Week 17, Days 1-2)**:
- Current stock levels
- Low stock alerts
- Expiry report
- Stock valuation
- Revenue summary
- Profit/loss by product
- Payment collection

**Phase 5D - Compliance (Week 17, Days 3-5)**:
- ⚠️ **BLOCKED** until Phase 6 audit logging complete
- Controlled substance dispensing log
- Prescription audit log
- User activity report

**Phase 5E - Testing & Optimization (Week 17, Day 5 + Week 18, Days 1-2)**:
- Integration testing
- Performance testing
- Query optimization
- Security testing

### 6.2 Implementation Priority Order

**Priority 1 - Core Infrastructure**:
1. Base report service with common functionality
2. Standard DTOs (filters, pagination, response)
3. Date handling utilities (timezone, range validation)
4. Authorization guards
5. Caching service

**Priority 2 - Simple Reports** (for early feedback):
1. Daily sales summary
2. Current stock levels
3. Revenue summary

**Priority 3 - Complex Reports**:
1. Top-selling products
2. Profit/loss by product
3. Sales by customer
4. Stock valuation

**Priority 4 - Compliance Reports**:
1. ⚠️ Wait for Phase 6 audit logging
2. Controlled substance log
3. Prescription audit
4. User activity

### 6.3 Technical Stack Recommendations

**Core Dependencies**:
```json
{
  "dependencies": {
    "@nestjs/throttler": "^5.0.0",    // Rate limiting
    "ioredis": "^5.3.0",                // Caching
    "date-fns": "^3.0.0",               // Date manipulation
    "date-fns-tz": "^2.0.0"             // Timezone handling
  }
}
```

**Optional (Advanced Features)**:
```json
{
  "dependencies": {
    "exceljs": "^4.3.0",                // Excel export
    "pdfkit": "^0.13.0",                // PDF generation
    "@nestjs/schedule": "^4.0.0"        // Scheduled reports
  }
}
```

### 6.4 Code Organization Best Practices

```typescript
// Base Report Service Pattern
@Injectable()
export abstract class BaseReportService<TDto, TResult> {
  constructor(
    protected prisma: PrismaService,
    protected cacheService: ReportCacheService,
  ) {}

  protected abstract buildQuery(dto: TDto, tenantId: string): any;
  protected abstract transformResult(data: any): TResult;

  async generate(dto: TDto, user: User): Promise<ReportResponse<TResult>> {
    // 1. Validate authorization
    this.validateAccess(user);

    // 2. Check cache
    const cached = await this.cacheService.get(this.getCacheKey(dto, user.tenantId));
    if (cached) return cached;

    // 3. Build and execute query with timeout
    const query = this.buildQuery(dto, user.tenantId);
    const data = await this.executeWithTimeout(query, 30000);

    // 4. Transform result
    const result = this.transformResult(data);

    // 5. Cache result
    await this.cacheService.set(this.getCacheKey(dto, user.tenantId), result, this.getCacheTTL());

    // 6. Audit log
    await this.auditReportAccess(user, dto);

    return result;
  }
}
```

### 6.5 Testing Strategy

**Unit Tests** (80%+ coverage target):
```typescript
describe('SalesReportService', () => {
  it('should calculate daily sales summary correctly', async () => {
    // Test with known data
    const result = await service.getDailySummary(dto, user);
    expect(result.data[0].total).toBe(expectedTotal);
  });

  it('should filter by tenantId', async () => {
    // Ensure tenant isolation
    const result = await service.getDailySummary(dto, user);
    expect(result.data.every(r => r.tenantId === user.tenantId)).toBe(true);
  });

  it('should handle empty results', async () => {
    // Edge case: no data in date range
    const result = await service.getDailySummary(emptyDateRange, user);
    expect(result.data).toHaveLength(0);
  });
});
```

**Integration Tests**:
```typescript
describe('Sales Reports (Integration)', () => {
  beforeAll(async () => {
    // Seed test data with known values
    await seedTestData();
  });

  it('should return accurate sales summary', async () => {
    const response = await request(app)
      .get('/api/reports/sales/daily')
      .set('Authorization', `Bearer ${token}`)
      .query({ startDate: '2025-01-01', endDate: '2025-01-31' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(31); // 31 days
    expect(response.body.metadata.aggregates.total).toBe(expectedMonthlyTotal);
  });
});
```

**Performance Tests**:
```typescript
it('should complete within SLA', async () => {
  const startTime = Date.now();
  await service.getTopSellingProducts(dto, user);
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(5000); // 5 second SLA
});
```

---

## 7. Risk Assessment & Mitigation

### 7.1 High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance degradation with large datasets | HIGH | MEDIUM | Early query optimization, caching, indexes |
| Cross-tenant data leakage | CRITICAL | LOW | Comprehensive tenant isolation testing |
| Inaccurate financial calculations | HIGH | MEDIUM | Peer review, validation against known results |
| DEA compliance format errors | HIGH | LOW | Regulatory expert consultation |
| Phase 5/6 dependency blocking compliance reports | MEDIUM | HIGH | Resolve sequencing before starting |

### 7.2 Medium Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Timeline overrun (2.5 weeks insufficient) | MEDIUM | HIGH | Use realistic 4-week estimate |
| Schema gaps require modifications | MEDIUM | MEDIUM | Validate schema assumptions early |
| Missing specifications cause rework | MEDIUM | HIGH | Define all specs before implementation |
| Complex queries cause OOM errors | MEDIUM | MEDIUM | Implement streaming/pagination |

### 7.3 Mitigation Strategies

**Performance Risks**:
- Start with query optimization from day one
- Implement caching in infrastructure phase
- Set conservative timeouts and limits
- Monitor query performance continuously
- Use EXPLAIN ANALYZE for slow queries
- Consider materialized views for expensive aggregations

**Data Accuracy Risks**:
- Create comprehensive test data with known values
- Implement validation against source transactions
- Peer review all calculation logic
- Document formulas and business rules
- Regular reconciliation checks

**Compliance Risks**:
- Engage regulatory expert for DEA requirements
- Implement comprehensive audit logging
- Ensure data retention policies enforced
- Regular compliance audits

**Security Risks**:
- Implement authorization from day one
- Multi-level tenant isolation testing
- Security code review before deployment
- Penetration testing of report endpoints
- Rate limiting on all endpoints

---

## 8. Success Criteria & Definition of Done

### 8.1 Functional Requirements

✅ **All report types implemented and tested**:
- 6 sales reports
- 5 inventory reports
- 4 financial reports
- 3 compliance reports (pending Phase 6)

✅ **Authorization working**:
- Role-based access enforced
- Tenant isolation verified
- No cross-tenant data leakage

✅ **Performance SLAs met**:
- 95% of queries complete <5 seconds
- No query exceeds timeout limit
- Cache hit rate >70%

✅ **Data accuracy**:
- 100% reconciliation with source transactions
- Financial calculations verified
- No rounding errors

### 8.2 Technical Requirements

✅ **Code quality**:
- Unit test coverage >80%
- Integration test coverage >70%
- No critical security vulnerabilities
- Code review completed

✅ **Documentation**:
- All endpoints documented in Swagger
- Report calculation formulas documented
- Authorization matrix documented
- Deployment guide complete

✅ **Security**:
- Authorization guards implemented
- Audit logging for all report access
- Rate limiting configured
- Input validation comprehensive

### 8.3 Acceptance Criteria

✅ **User stories completed**:
- As an admin, I can view all reports for my tenant
- As a manager, I can view sales and financial reports
- As a pharmacist, I can view inventory and prescription reports
- As a cashier, I can view my own sales performance

✅ **Non-functional requirements**:
- System remains responsive during report generation
- No performance degradation on production database
- Reports scale to millions of records
- Multi-tenant isolation maintained

---

## 9. Pre-Implementation Checklist

Before starting Phase 5 implementation, ensure ALL items are completed:

### 9.1 Specifications (BLOCKING)

- [ ] **Authorization Matrix**: Define which roles access which reports
- [ ] **Timezone Strategy**: Define timezone handling approach
- [ ] **Export Requirements**: Clarify if Excel/PDF export is in scope
- [ ] **Performance SLAs**: Define concrete response time targets
- [ ] **Phase Sequencing**: Resolve Phase 5/6 dependency issue

### 9.2 Schema Validation (BLOCKING)

- [ ] **Verify SaleItem.batchId**: Confirm foreign key exists for profit/loss calculation
- [ ] **Verify Outstanding Payments**: Confirm Sale.paidAmount < totalAmount approach
- [ ] **Dead Stock Strategy**: Decide on implementation approach (field vs query vs cache)

### 9.3 Infrastructure (MUST HAVE)

- [ ] **Redis Setup**: Configure Redis for caching
- [ ] **Database Indexes**: Create required composite indexes
- [ ] **Test Data**: Generate comprehensive test data with known values
- [ ] **Monitoring**: Set up query performance monitoring

### 9.4 Cross-Functional Alignment

- [ ] **Security Review**: Confirm authorization and audit logging requirements
- [ ] **Compliance Review**: Validate DEA reporting format requirements
- [ ] **Performance Review**: Confirm caching and optimization strategies
- [ ] **UI/Frontend Coordination**: Clarify API contract and response formats

---

## 10. Immediate Action Items

### Priority 1 - BLOCKING ISSUES (Must resolve before starting)

1. **Define Authorization Matrix**
   - Owner: Product Manager + Security Lead
   - Deadline: Before Phase 5 kickoff
   - Deliverable: Documented matrix of role → report access

2. **Resolve Phase 5/6 Sequencing**
   - Owner: Project Manager
   - Options:
     - A) Move audit logging to Phase 5
     - B) Defer compliance reports to Phase 6
     - C) Implement basic audit logging in Phase 5, enhance in Phase 6
   - Decision needed: Before Phase 5 kickoff

3. **Clarify Export Requirements**
   - Owner: Product Manager
   - Question: Is Excel/PDF export in scope for Phase 5?
   - Impact: +1-2 weeks if yes
   - Decision needed: Before Phase 5 kickoff

### Priority 2 - TECHNICAL PREPARATION

4. **Validate Schema Assumptions**
   - Owner: Lead Developer
   - Action: Review actual schema.prisma to confirm:
     - SaleItem.batchId exists
     - Outstanding payment tracking approach
     - Dead stock reporting data availability
   - Deadline: Week 14 (before Phase 5)

5. **Define Timezone Strategy**
   - Owner: Technical Lead
   - Decision: UTC / Tenant timezone / User timezone
   - Document: How to handle date grouping
   - Deadline: Week 14

6. **Performance SLA Definition**
   - Owner: Technical Lead + Product Manager
   - Define:
     - Target response time (<5 seconds?)
     - Maximum timeout (30 seconds?)
     - Cache TTL strategy (5 min - 1 hour?)
   - Deadline: Week 14

### Priority 3 - INFRASTRUCTURE SETUP

7. **Redis Configuration**
   - Owner: DevOps
   - Action: Set up Redis instance for caching
   - Deadline: Week 14

8. **Database Index Creation**
   - Owner: Database Admin
   - Action: Create required composite indexes
   - Deadline: Week 14

9. **Test Data Generation**
   - Owner: QA + Developer
   - Action: Generate comprehensive test data
   - Requirements:
     - Multiple tenants (at least 3)
     - Sales data (1000+ records per tenant)
     - Products with various categories
     - Prescriptions with different statuses
     - Stock movements over 6+ months
   - Deadline: Week 15 Day 1

---

## 11. Recommended Timeline (Revised)

### Original Plan
- **Duration**: 2.5 weeks
- **Weeks**: 15-17

### Realistic Plan
- **Duration**: 4 weeks
- **Weeks**: 15-18

### Detailed Breakdown

**Week 15**:
- Days 1-3: Infrastructure + simple reports (sales summary, current stock)
- Days 4-5: Sales reports (by product, by customer, by payment)

**Week 16**:
- Days 1-2: Sales reports completion (by user, top-selling)
- Days 3-4: Inventory reports (stock levels, low stock, expiry)
- Day 5: Financial reports (revenue, payment collection)

**Week 17**:
- Days 1-2: Financial reports (profit/loss, stock valuation)
- Days 3-5: Compliance reports (BLOCKED pending Phase 6)

**Week 18**:
- Days 1-2: Testing, optimization, documentation
- Days 3-5: Buffer for issues and refinement

**Week 19** (if Phase 6 completed):
- Implement compliance reports

---

## 12. Conclusion

Phase 5 Reporting & Analytics is a **critical business intelligence module** that provides visibility into pharmacy operations, financial performance, and regulatory compliance.

### Key Takeaways

**✅ STRENGTHS**:
- Comprehensive report coverage
- Well-structured architecture
- Clear dependencies on operational modules

**⚠️ CONCERNS**:
- Timeline underestimated (4 weeks realistic vs 2.5 weeks planned)
- Critical dependencies on Phase 6 (audit logging)
- Missing specifications (authorization, timezone, exports)
- Performance risks with large datasets
- Schema gaps for some reports

**🎯 RECOMMENDATIONS**:
1. **Resolve blocking issues BEFORE starting implementation**
2. **Use realistic 4-week timeline**
3. **Implement infrastructure first** (caching, base services, authorization)
4. **Start with simple reports** for early feedback
5. **Defer compliance reports** until Phase 6 audit logging complete
6. **Implement comprehensive testing** from day one
7. **Monitor query performance** continuously

### Final Status

📊 **Analysis Status**: COMPLETE
🚫 **Implementation Status**: DO NOT START until blocking issues resolved
⏰ **Recommended Start**: After Week 14 preparation complete
✅ **Ready for**: Specification review and technical planning

---

## Document Metadata

**Version**: 1.0
**Author**: Claude (SuperClaude Analysis Framework)
**Analysis Method**: Sequential Thinking (20 reasoning steps)
**Analysis Depth**: Ultra-comprehensive (--ultrathink)
**Date**: 2025-01-12
**Status**: Requirements Analysis Complete

**Next Steps**:
1. Review this analysis with product manager
2. Resolve all blocking issues
3. Update implementation plan with realistic timeline
4. Schedule Phase 5 kickoff after preparation complete
