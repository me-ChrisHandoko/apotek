# Pharmacy Management System - Quick Reference Guide

## Overview
This guide provides a quick reference to the core modules and implementation phases.

---

## 📋 Core Modules Summary

| # | Module | Models Used | Priority | Complexity |
|---|--------|-------------|----------|------------|
| 1 | Authentication & Authorization | User | Critical | Medium |
| 2 | Tenant Management | Tenant | Critical | Low |
| 3 | User Management | User | Critical | Low |
| 4 | Product Category | ProductCategory | High | Low |
| 5 | Product Management | Product | High | Medium |
| 6 | Inventory Management | ProductBatch | High | High |
| 7 | Customer Management | Customer | High | Low |
| 8 | Supplier Management | Supplier | High | Low |
| 9 | Prescription Management | Prescription, PrescriptionItem | High | Medium |
| 10 | Sales/POS | Sale, SaleItem | Critical | High |
| 11 | Purchase Order | PurchaseOrder | Medium | Medium |
| 12 | Stock Adjustment | StockAdjustment | Medium | Medium |
| 13 | Reporting & Analytics | All | Medium | High |
| 14 | Audit & Compliance | AuditLog | High | Medium |

---

## 🎯 Implementation Timeline

```
Phase 1: Foundation (Weeks 1-3)
├─ Authentication & Authorization (1.5w)
├─ Tenant Management (1w)
└─ User Management (0.5w)

Phase 2: Master Data (Weeks 4-6)
├─ Product Category (0.5w)
├─ Product Management (2w)
├─ Customer Management (1.5w)
└─ Supplier Management (1w)

Phase 3: Operations (Weeks 7-10)
├─ Inventory Management (2.5w)
├─ Stock Adjustment (1w)
└─ Prescription Management (2w)

Phase 4: Transactions (Weeks 11-14)
├─ Sales/POS Module (3w)
└─ Purchase Order (2w)

Phase 5: Reporting (Weeks 15-17)
└─ Reporting & Analytics (2.5w)

Phase 6: Audit (Weeks 18-19)
└─ Audit & Compliance (1.5w)
```

**Total Duration**: 19 weeks (~4.5 months)

---

## 🔑 Key Features by Module

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing & reset
- Token refresh mechanism

### Tenant Management
- Multi-tenant data isolation
- Tenant settings (JSON config)
- Tenant context middleware

### Product Management
- Barcode support (UPC/EAN/GS1)
- DEA Schedule classification
- Prescription requirement flag
- Minimum stock alerts

### Inventory Management
- Batch-level tracking
- Expiry date monitoring
- FEFO (First Expiry First Out)
- Low stock alerts

### Sales/POS
- Multiple payment methods
- Prescription validation
- Stock deduction
- Returns & cancellations

### Prescription Management
- Doctor information capture
- Prescription validation
- Controlled substance tracking
- Dispensing history

---

## 🛡️ Security & Compliance

### Authentication Security
- JWT with 15min access, 7day refresh
- Argon2id password hashing (recommended defaults)
- Account lockout after 5 failed attempts

### Data Protection
- Row-level tenant isolation
- Encrypted sensitive data
- HTTPS/TLS required

### Regulatory Compliance
- DEA controlled substance tracking
- HIPAA patient data protection
- Audit logging for all critical operations

---

## 📊 Database Schema Summary

**Total Models**: 15
- Core: Tenant, User
- Master Data: Product, ProductCategory, ProductBatch, Customer, Supplier
- Operations: Prescription, PrescriptionItem, Sale, SaleItem, PurchaseOrder
- System: StockAdjustment, AuditLog

**Total Enums**: 9
- UserRole, UnitType, PaymentMethod, PaymentStatus
- SaleStatus, PrescriptionStatus, PurchaseOrderStatus
- AdjustmentType, AuditAction, DEASchedule

---

## 🧪 Testing Requirements

| Test Type | Coverage Target | Focus Areas |
|-----------|----------------|-------------|
| Unit Tests | 80%+ | Service layer, utilities, validation |
| Integration Tests | 70%+ | API endpoints, database operations |
| E2E Tests | Key workflows | Login → Sale, PO → Stock, Prescription → Dispense |

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Start development server
npm run start:dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

---

## 📁 Project Structure

```
src/
├── modules/
│   ├── auth/
│   ├── tenant/
│   ├── user/
│   ├── product/
│   ├── product-category/
│   ├── inventory/
│   ├── customer/
│   ├── supplier/
│   ├── prescription/
│   ├── sales/
│   ├── purchase-order/
│   ├── stock-adjustment/
│   ├── reporting/
│   └── audit/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   └── pipes/
├── config/
└── prisma/
    └── schema.prisma
```

---

## 🎓 Key Concepts

### Multi-Tenancy
All models (except enums) have `tenantId` for data isolation. Every query must filter by tenant.

### Batch-Level Inventory
Stock is tracked at the batch level (ProductBatch), not product level. This enables:
- Expiry tracking per batch
- FEFO dispensing logic
- Batch-specific pricing

### UUID v7 for ID Generation
**Time-ordered UUIDs** (RFC 9562) provide optimal performance for transaction models:
- **Natural Chronological Sorting**: Sales, prescriptions, audit logs sort by creation time
- **~40% Faster Inserts**: Better B-tree performance than random UUIDs or CUID
- **Compliance Benefits**: Embedded timestamps for HIPAA/DEA audit trails
- **PostgreSQL Optimized**: Better index locality reduces page splits

**Implementation**: Use `UuidService.generateV7()` for Sale, AuditLog, RefreshToken, Prescription models.

**Installation**:
```bash
npm install uuid @types/uuid
```

**Usage Example**:
```typescript
import { UuidService } from '@/common/services/uuid.service';

const saleId = this.uuid.generateV7();
await this.prisma.sale.create({ data: { id: saleId, ...data } });
```

**See**: `implementation-plan.md` - ID Generation Strategy section for detailed guidance.

### Prescription Flow
1. Create prescription with items
2. Validate prescription before sale
3. Link sale to prescription
4. Update prescription status to DISPENSED
5. Track controlled substance dispensing

### Sale Transaction
1. Validate stock availability
2. Check expiry dates
3. Validate prescription (if required)
4. Select batches using FEFO
5. Deduct stock from batches
6. Generate invoice
7. Create audit log

---

## ⚠️ Important Notes

### DO NOT Modify
- `schema.prisma` - Schema is finalized and must not be changed

### Multi-Tenant Rules
- Always include `tenantId` in queries
- Use tenant context middleware
- Test cross-tenant access prevention

### Controlled Substances
- Require valid prescription for DEA Schedule II-V
- Enhanced audit logging
- Track doctor license numbers
- Validate prescription dates

### Stock Management
- Always use transactions for stock operations
- Implement FEFO logic for batch selection
- Prevent sale of expired batches
- Automatic expiry alerts

---

## 📞 Support & Documentation

For detailed information, refer to:
- **Full Implementation Plan**: `docs/implementation-plan.md`
- **Schema Documentation**: `prisma/schema.prisma`
- **API Documentation**: (Generate with Swagger after implementation)

---

## 🏁 Success Milestones

- [ ] **Week 3**: Users can authenticate and access tenant-scoped data
- [ ] **Week 6**: Master data (products, customers, suppliers) fully functional
- [ ] **Week 10**: Inventory and prescriptions are operational
- [ ] **Week 14**: Sales and purchase orders are complete
- [ ] **Week 17**: Key reports are available
- [ ] **Week 19**: Full audit logging implemented

---

**Document Version**: 1.0
**Last Updated**: 2025-01-11
