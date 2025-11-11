# Phase 2 Requirements Analysis - Master Data Management

## Executive Summary

This document provides a comprehensive requirements analysis for Phase 2 of the Pharmacy Management System implementation. Phase 2 focuses on Master Data Management modules that form the foundation for all operational modules in subsequent phases.

**Analysis Date**: 2025-01-11
**Status**: Requirements Analysis Complete - Ready for Implementation
**Estimated Duration**: 3 weeks (Weeks 4-6)
**Total Modules**: 4 modules
**Total Files Required**: 22+ files

---

## Critical Schema Discrepancies Found

During analysis, the following discrepancies were identified between the implementation plan and the actual Prisma schema:

### ⚠️ CRITICAL: ProductCategory Code Field

**Implementation Plan States**: ProductCategory has a "code" field
**Actual Schema**: ProductCategory has NO "code" field

**Actual Fields** (lines 151-165 in schema.prisma):
- id, tenantId, name, description, isActive, createdAt, updatedAt

**Impact**: DTOs must NOT include a code field. Category identification is by name only.

**Action Required**: Update all references to remove code field from ProductCategory DTOs.

---

### ⚠️ CRITICAL: Product sellingPrice Field

**Implementation Plan States**: Product model has "sellingPrice: Decimal" field
**Actual Schema**: Product model has NO sellingPrice field

**Reality**: sellingPrice is in **ProductBatch** model (line 210), not Product model.

**Rationale**: Batch-level pricing allows different prices for different batches (different suppliers, different purchase dates).

**Impact**:
- Product DTOs must NOT include sellingPrice
- Pricing logic must be implemented at batch level
- Product master data is for catalog information only

**Action Required**: Remove sellingPrice from all Product DTOs and documentation.

---

### ⚠️ MEDIUM: DEASchedule Enum Default Value

**Implementation Plan States**: Default value is "NOT_CONTROLLED"
**Actual Schema**: Default value is "UNSCHEDULED" (line 87)

**Enum Values**:
- SCHEDULE_I, SCHEDULE_II, SCHEDULE_III, SCHEDULE_IV, SCHEDULE_V, UNSCHEDULED

**Action Required**: Use "UNSCHEDULED" as default value in all DTOs and documentation.

---

## Module 2.1: Product Category Management

### Overview
- **Priority**: High
- **Estimated Effort**: 0.5 weeks (2-3 days)
- **Complexity**: Low
- **Dependencies**: Tenant (Phase 1), Auth (Phase 1)
- **Required By**: Product (2.2)

### File Structure
```
src/modules/product-category/
├── product-category.controller.ts    # HTTP endpoints for CRUD
├── product-category.service.ts       # Business logic layer
├── product-category.module.ts        # NestJS module definition
├── dto/
│   ├── create-category.dto.ts        # Creation validation
│   └── update-category.dto.ts        # Update validation
├── product-category.controller.spec.ts
└── product-category.service.spec.ts
```

### Data Model (CORRECTED from Schema)
```typescript
{
  id: string;              // CUID/UUID v7
  tenantId: string;        // Foreign key to Tenant
  name: string;            // Category name
  description?: string;    // Optional description
  isActive: boolean;       // Active status (default: true)
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### DTOs Required

#### create-category.dto.ts
```typescript
{
  name: string;            // Required, 2-100 chars
  description?: string;    // Optional, max 500 chars
  isActive?: boolean;      // Optional, default true
}
```

**Validation Rules**:
- name: required, string, minLength(2), maxLength(100)
- description: optional, string, maxLength(500)
- isActive: optional, boolean
- NO code field

#### update-category.dto.ts
```typescript
// Use PartialType(CreateCategoryDto)
// All fields optional, same validation rules
```

### API Endpoints

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /product-categories | Create category | JWT | ADMIN, MANAGER |
| GET | /product-categories | List categories | JWT | ALL |
| GET | /product-categories/:id | Get single category | JWT | ALL |
| PATCH | /product-categories/:id | Update category | JWT | ADMIN, MANAGER |
| DELETE | /product-categories/:id | Delete category | JWT | ADMIN |

### Query Parameters (List Endpoint)
- search: string (search by name)
- isActive: boolean
- page: number (default: 1)
- limit: number (default: 20, max: 100)
- sortBy: 'name' | 'createdAt'
- sortOrder: 'asc' | 'desc'

### Service Methods

```typescript
class ProductCategoryService {
  create(dto: CreateCategoryDto, tenantId: string): Promise<ProductCategory>
  findAll(filter: FilterDto, tenantId: string): Promise<PaginatedResult>
  findOne(id: string, tenantId: string): Promise<ProductCategory>
  update(id: string, dto: UpdateCategoryDto, tenantId: string): Promise<ProductCategory>
  remove(id: string, tenantId: string): Promise<void>
  checkDependencies(id: string, tenantId: string): Promise<boolean>
}
```

### Business Rules
1. ✅ Name must be unique within tenant (not enforced by schema, validate in service)
2. ✅ All operations must be tenant-scoped
3. ✅ Cannot delete category if products are assigned to it
4. ✅ Soft delete option (set isActive = false)
5. ✅ Category hierarchy NOT supported in current schema

### Testing Requirements

**Unit Tests**:
- Create category with valid data
- Validate name required
- Validate description max length
- Update category
- Tenant isolation

**Integration Tests**:
- Full CRUD flow with authentication
- Pagination functionality
- Search by name
- Delete prevention when products exist

---

## Module 2.2: Product Management

### Overview
- **Priority**: High
- **Estimated Effort**: 2 weeks
- **Complexity**: Medium-High
- **Dependencies**: Tenant (Phase 1), ProductCategory (2.1)
- **Required By**: Inventory (3.1), Sales (4.1), Prescription (3.3)

### File Structure
```
src/modules/product/
├── product.controller.ts          # HTTP endpoints
├── product.service.ts             # Core business logic
├── product.module.ts              # Module definition
├── dto/
│   ├── create-product.dto.ts      # Creation validation
│   ├── update-product.dto.ts      # Update validation
│   └── search-product.dto.ts      # Search parameters
├── product.controller.spec.ts
└── product.service.spec.ts
```

### Data Model (CORRECTED from Schema)
```typescript
{
  id: string;                      // CUID/UUID v7
  tenantId: string;                // Foreign key
  code: string;                    // SKU/Product code (unique per tenant)
  barcode?: string;                // UPC/EAN barcode (unique per tenant)
  name: string;                    // Product name
  genericName?: string;            // Generic name
  manufacturer?: string;           // Manufacturer name
  categoryId?: string;             // Foreign key (nullable)
  unitType: UnitType;              // ENUM: TABLET, CAPSULE, SYRUP, etc.
  description?: string;            // Product description
  requiresPrescription: boolean;   // Prescription requirement flag
  deaSchedule?: DEASchedule;       // ENUM: SCHEDULE_I-V, UNSCHEDULED
  minStockLevel: number;           // Minimum stock alert level
  isActive: boolean;               // Active status
  createdAt: DateTime;
  updatedAt: DateTime;

  // NO sellingPrice field - pricing is batch-level!
}
```

### Enums

#### UnitType (from schema lines 23-32)
```typescript
enum UnitType {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  CREAM = 'CREAM',
  DROPS = 'DROPS',
  OINTMENT = 'OINTMENT',
  POWDER = 'POWDER'
}
```

#### DEASchedule (from schema lines 81-88)
```typescript
enum DEASchedule {
  SCHEDULE_I = 'SCHEDULE_I',      // High abuse potential, no medical use
  SCHEDULE_II = 'SCHEDULE_II',    // High abuse, severe restrictions
  SCHEDULE_III = 'SCHEDULE_III',  // Moderate to low abuse potential
  SCHEDULE_IV = 'SCHEDULE_IV',    // Low abuse potential
  SCHEDULE_V = 'SCHEDULE_V',      // Lower abuse potential
  UNSCHEDULED = 'UNSCHEDULED'     // Not controlled (DEFAULT)
}
```

### DTOs Required

#### create-product.dto.ts
```typescript
{
  code: string;                    // Required, 3-50 chars, alphanumeric
  barcode?: string;                // Optional, valid barcode format
  name: string;                    // Required, 3-200 chars
  genericName?: string;            // Optional, max 200 chars
  manufacturer?: string;           // Optional, max 100 chars
  categoryId?: string;             // Optional, must exist if provided
  unitType: UnitType;              // Required, enum validation
  description?: string;            // Optional, max 500 chars
  requiresPrescription: boolean;   // Required, default false
  deaSchedule?: DEASchedule;       // Optional, default UNSCHEDULED
  minStockLevel: number;           // Required, min 0, default 0
  isActive?: boolean;              // Optional, default true

  // NO sellingPrice field!
}
```

**Validation Rules**:
- code: required, string, minLength(3), maxLength(50), matches(/^[A-Z0-9-_]+$/i)
- barcode: optional, string, custom barcode format validator
- name: required, string, minLength(3), maxLength(200)
- genericName: optional, string, maxLength(200)
- manufacturer: optional, string, maxLength(100)
- categoryId: optional, string, isUUID, category must exist
- unitType: required, isEnum(UnitType)
- description: optional, string, maxLength(500)
- requiresPrescription: required, isBoolean
- deaSchedule: optional, isEnum(DEASchedule)
- minStockLevel: required, isInt, min(0)
- isActive: optional, isBoolean

#### update-product.dto.ts
```typescript
// Use PartialType(CreateProductDto)
// All fields optional, same validation rules
```

#### search-product.dto.ts
```typescript
{
  search?: string;              // Multi-field search
  categoryId?: string;          // Filter by category
  requiresPrescription?: boolean;
  deaSchedule?: DEASchedule;
  isActive?: boolean;
  minStock?: boolean;           // Products below minStockLevel
  page?: number;                // Default 1
  limit?: number;               // Default 20, max 100
  sortBy?: string;              // 'name' | 'code' | 'createdAt'
  sortOrder?: 'asc' | 'desc';   // Default 'asc'
}
```

### API Endpoints

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /products | Create product | JWT | ADMIN, MANAGER, PHARMACIST |
| GET | /products | List/search products | JWT | ALL |
| GET | /products/:id | Get product details | JWT | ALL |
| PATCH | /products/:id | Update product | JWT | ADMIN, MANAGER, PHARMACIST |
| DELETE | /products/:id | Delete product | JWT | ADMIN |

### Service Methods

```typescript
class ProductService {
  create(dto: CreateProductDto, tenantId: string): Promise<Product>
  findAll(filter: SearchProductDto, tenantId: string): Promise<PaginatedResult>
  findOne(id: string, tenantId: string): Promise<Product>
  update(id: string, dto: UpdateProductDto, tenantId: string): Promise<Product>
  remove(id: string, tenantId: string): Promise<void>

  // Validation methods
  validateCode(code: string, tenantId: string, excludeId?: string): Promise<boolean>
  validateBarcode(barcode: string, tenantId: string, excludeId?: string): Promise<boolean>

  // Business logic methods
  checkDependencies(id: string, tenantId: string): Promise<boolean>
  getCurrentStockLevel(productId: string, tenantId: string): Promise<number>

  // Search methods
  search(query: SearchProductDto, tenantId: string): Promise<PaginatedResult>
}
```

### Business Rules

1. ✅ Code must be unique within tenant (enforced by @@unique([tenantId, code]))
2. ✅ Barcode must be unique within tenant if provided (enforced by @@unique([tenantId, barcode]))
3. ✅ If deaSchedule is SCHEDULE_I/II/III/IV/V, requiresPrescription must be true
4. ✅ CategoryId must exist in ProductCategory table if provided
5. ✅ UnitType must be valid enum value
6. ✅ Cannot delete product if inventory batches exist
7. ✅ Cannot delete product if used in any sales or prescriptions
8. ✅ Barcode format validation (UPC, EAN-13, EAN-8)

### Search Implementation

**Multi-field Search** (when search parameter provided):
```sql
WHERE tenantId = ? AND (
  code ILIKE '%search%' OR
  barcode ILIKE '%search%' OR
  name ILIKE '%search%' OR
  genericName ILIKE '%search%'
)
```

**Additional Filters**:
- categoryId exact match
- requiresPrescription exact match
- deaSchedule exact match
- isActive exact match
- minStock: products where current stock < minStockLevel

### Testing Requirements

**Unit Tests**:
- Create product with all enum validations
- Barcode uniqueness validation
- Code uniqueness validation
- DEA schedule + prescription requirement correlation
- Category existence validation
- UnitType enum validation
- No sellingPrice field test

**Integration Tests**:
- Full CRUD flow
- Multi-field search functionality
- Filter by category
- Filter by prescription requirement
- Pagination
- Tenant isolation

---

## Module 2.3: Customer Management

### Overview
- **Priority**: High
- **Estimated Effort**: 1.5 weeks
- **Complexity**: Medium
- **Dependencies**: Tenant (Phase 1)
- **Required By**: Sales (4.1), Prescription (3.3)

### File Structure
```
src/modules/customer/
├── customer.controller.ts         # HTTP endpoints
├── customer.service.ts            # Business logic
├── customer.module.ts             # Module definition
├── dto/
│   ├── create-customer.dto.ts     # Creation validation
│   ├── update-customer.dto.ts     # Update validation
│   └── search-customer.dto.ts     # Search parameters
├── customer.controller.spec.ts
└── customer.service.spec.ts
```

### Data Model (from Schema)
```typescript
{
  id: string;                  // CUID/UUID v7
  tenantId: string;            // Foreign key
  code: string;                // Customer code (unique per tenant)
  name: string;                // Customer name
  phone?: string;              // Phone number
  email?: string;              // Email address
  address?: string;            // Physical address
  dateOfBirth?: DateTime;      // Date of birth
  allergies?: Json;            // Allergy information (JSON)
  notes?: string;              // Additional notes

  // Insurance fields
  insuranceProvider?: string;  // Insurance company name
  insurancePolicyNo?: string;  // Policy/member number
  insuranceGroupNo?: string;   // Group number
  insuranceExpiry?: DateTime;  // Policy expiration date
  insuranceNotes?: string;     // Additional insurance notes

  isActive: boolean;           // Active status
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### DTOs Required

#### create-customer.dto.ts
```typescript
{
  code: string;                    // Required, 3-20 chars
  name: string;                    // Required, 3-200 chars
  phone?: string;                  // Optional, valid phone format
  email?: string;                  // Optional, valid email format
  address?: string;                // Optional, max 500 chars
  dateOfBirth?: Date;              // Optional, past date
  allergies?: AllergyDto[];        // Optional, JSON array
  notes?: string;                  // Optional, max 1000 chars

  // Insurance fields (all optional)
  insuranceProvider?: string;      // Max 100 chars
  insurancePolicyNo?: string;      // Max 50 chars
  insuranceGroupNo?: string;       // Max 50 chars
  insuranceExpiry?: Date;          // Future date validation
  insuranceNotes?: string;         // Max 500 chars

  isActive?: boolean;              // Optional, default true
}
```

**AllergyDto Structure**:
```typescript
{
  allergen: string;     // Allergen name (e.g., "Penicillin")
  severity: string;     // Severity level (e.g., "Mild", "Moderate", "Severe")
  notes?: string;       // Additional notes
}
```

**Validation Rules**:
- code: required, 3-20 chars, alphanumeric
- name: required, 3-200 chars
- phone: optional, custom phone validator
- email: optional, isEmail()
- address: optional, max 500 chars
- dateOfBirth: optional, isDate(), isPast()
- allergies: optional, isArray(), custom allergy validator
- At least one contact method (phone OR email) recommended
- insuranceExpiry: optional, isDate(), isFuture()

### API Endpoints

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /customers | Create customer | JWT | ALL roles |
| GET | /customers | List/search customers | JWT | ALL |
| GET | /customers/:id | Get customer details | JWT | ALL |
| PATCH | /customers/:id | Update customer | JWT | ADMIN, MANAGER, PHARMACIST |
| DELETE | /customers/:id | Delete customer | JWT | ADMIN |
| GET | /customers/:id/purchase-history | Get sales history | JWT | ALL |
| GET | /customers/:id/prescriptions | Get prescriptions | JWT | ALL |

### Service Methods

```typescript
class CustomerService {
  create(dto: CreateCustomerDto, tenantId: string): Promise<Customer>
  findAll(filter: SearchCustomerDto, tenantId: string): Promise<PaginatedResult>
  findOne(id: string, tenantId: string): Promise<Customer>
  update(id: string, dto: UpdateCustomerDto, tenantId: string): Promise<Customer>
  remove(id: string, tenantId: string): Promise<void>

  // Auto-generation
  generateCustomerCode(tenantId: string): Promise<string>

  // Business logic
  validateInsurance(customerId: string, tenantId: string): Promise<boolean>
  getPurchaseHistory(customerId: string, tenantId: string): Promise<Sale[]>
  getPrescriptionHistory(customerId: string, tenantId: string): Promise<Prescription[]>
  getAllergyWarnings(customerId: string, productIds: string[], tenantId: string): Promise<Warning[]>
  checkDependencies(id: string, tenantId: string): Promise<boolean>
}
```

### Business Rules

1. ✅ Code auto-generation: "CUST-0001", "CUST-0002", etc.
2. ✅ Code must be unique within tenant
3. ✅ At least one contact method recommended (phone OR email)
4. ✅ Insurance expiry validation during sales
5. ✅ Allergy warnings during prescription/sales
6. ✅ Cannot delete customer if sales or prescriptions exist
7. ✅ Age calculation from dateOfBirth for pediatric/geriatric flags
8. ✅ Allergy JSON structure validation

### Testing Requirements

**Unit Tests**:
- Create customer with auto-code generation
- Insurance validation
- Allergy JSON structure validation
- Email/phone format validation
- Age calculation from dateOfBirth

**Integration Tests**:
- Full CRUD flow
- Purchase history retrieval
- Prescription history retrieval
- Search by multiple fields

---

## Module 2.4: Supplier Management

### Overview
- **Priority**: High
- **Estimated Effort**: 1 week
- **Complexity**: Low-Medium
- **Dependencies**: Tenant (Phase 1)
- **Required By**: Purchase Order (4.2), ProductBatch (3.1)

### File Structure
```
src/modules/supplier/
├── supplier.controller.ts         # HTTP endpoints
├── supplier.service.ts            # Business logic
├── supplier.module.ts             # Module definition
├── dto/
│   ├── create-supplier.dto.ts     # Creation validation
│   └── update-supplier.dto.ts     # Update validation
├── supplier.controller.spec.ts
└── supplier.service.spec.ts
```

### Data Model (from Schema)
```typescript
{
  id: string;              // CUID/UUID v7
  tenantId: string;        // Foreign key
  code: string;            // Supplier code (unique per tenant)
  name: string;            // Supplier name
  contactPerson?: string;  // Contact person name
  phone?: string;          // Phone number
  email?: string;          // Email address
  address?: string;        // Physical address
  paymentTerms?: string;   // Payment terms (e.g., "Net 30", "COD")
  isActive: boolean;       // Active status
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### DTOs Required

#### create-supplier.dto.ts
```typescript
{
  code: string;            // Required, 3-20 chars
  name: string;            // Required, 3-200 chars
  contactPerson?: string;  // Optional, max 100 chars
  phone?: string;          // Optional, valid phone format
  email?: string;          // Optional, valid email format
  address?: string;        // Optional, max 500 chars
  paymentTerms?: string;   // Optional, max 100 chars
  isActive?: boolean;      // Optional, default true
}
```

**Validation Rules**:
- code: required, 3-20 chars, alphanumeric
- name: required, 3-200 chars
- contactPerson: optional, max 100 chars
- phone: optional, custom phone validator
- email: optional, isEmail()
- address: optional, max 500 chars
- paymentTerms: optional, max 100 chars (e.g., "Net 30", "COD", "Net 60")

### API Endpoints

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /suppliers | Create supplier | JWT | ADMIN, MANAGER |
| GET | /suppliers | List suppliers | JWT | ADMIN, MANAGER, PHARMACIST |
| GET | /suppliers/:id | Get supplier details | JWT | ADMIN, MANAGER, PHARMACIST |
| PATCH | /suppliers/:id | Update supplier | JWT | ADMIN, MANAGER |
| DELETE | /suppliers/:id | Delete supplier | JWT | ADMIN |

### Service Methods

```typescript
class SupplierService {
  create(dto: CreateSupplierDto, tenantId: string): Promise<Supplier>
  findAll(filter: FilterDto, tenantId: string): Promise<PaginatedResult>
  findOne(id: string, tenantId: string): Promise<Supplier>
  update(id: string, dto: UpdateSupplierDto, tenantId: string): Promise<Supplier>
  remove(id: string, tenantId: string): Promise<void>

  // Auto-generation
  generateSupplierCode(tenantId: string): Promise<string>

  // Business logic
  checkDependencies(id: string, tenantId: string): Promise<boolean>
  getPurchaseOrderHistory(supplierId: string, tenantId: string): Promise<PurchaseOrder[]>
  getSuppliedProducts(supplierId: string, tenantId: string): Promise<ProductBatch[]>
}
```

### Business Rules

1. ✅ Code auto-generation: "SUP-0001", "SUP-0002", etc.
2. ✅ Code must be unique within tenant
3. ✅ At least one contact method recommended (phone OR email)
4. ✅ Cannot delete supplier if purchase orders exist
5. ✅ Cannot delete supplier if product batches exist
6. 🔄 Track supplier performance (future enhancement)

---

## Cross-Cutting Concerns

### Authentication & Authorization

**All endpoints require**:
- JWT authentication via @UseGuards(JwtAuthGuard)
- JWT payload contains: userId, tenantId, role
- Token expiration: 15 minutes (access), 7 days (refresh)

**Role-Based Access Control**:

| Operation | ProductCategory | Product | Customer | Supplier |
|-----------|----------------|---------|----------|----------|
| CREATE | ADMIN, MANAGER | ADMIN, MANAGER, PHARMACIST | ALL | ADMIN, MANAGER |
| READ | ALL | ALL | ALL | ADMIN, MANAGER, PHARMACIST |
| UPDATE | ADMIN, MANAGER | ADMIN, MANAGER, PHARMACIST | ADMIN, MANAGER, PHARMACIST | ADMIN, MANAGER |
| DELETE | ADMIN | ADMIN | ADMIN | ADMIN |

### Tenant Isolation

**All queries must**:
- Include tenantId filter automatically
- Use @CurrentTenant() decorator to inject tenantId from JWT
- Verify tenant context in all service methods
- Prevent cross-tenant data access

**Implementation Pattern**:
```typescript
@Get()
@UseGuards(JwtAuthGuard)
async findAll(
  @CurrentTenant() tenantId: string,
  @Query() filter: FilterDto
) {
  return this.service.findAll(filter, tenantId);
}
```

### Validation Strategy

**Use class-validator decorators**:
- @IsString(), @IsEmail(), @IsBoolean()
- @MinLength(), @MaxLength()
- @IsEnum()
- @IsOptional()
- Custom validators for complex business rules

**Custom Validators Needed**:
- BarcodeValidator: Validate UPC/EAN-13/EAN-8 formats
- PhoneValidator: Validate phone number formats
- CodeFormatValidator: Alphanumeric with dash/underscore
- AllergyStructureValidator: Validate allergy JSON structure

### Error Handling

**Standard Error Response**:
```typescript
{
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
}
```

**Custom Exceptions**:
- DuplicateCodeException (409)
- InvalidBarcodeException (400)
- CategoryNotFoundException (404)
- DependencyExistsException (422)
- TenantMismatchException (403)

### Pagination Pattern

**Standard Pagination**:
```typescript
{
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

**Configuration**:
- Default limit: 20
- Maximum limit: 100
- Page numbering starts at 1

### Performance Optimization

**Database Indexes** (already in schema):
- ProductCategory: @@index([tenantId])
- Product: @@index([tenantId]), @@index([tenantId, categoryId]), @@index([barcode])
- Customer: @@index([tenantId]), @@index([phone]), @@index([insurancePolicyNo])
- Supplier: @@index([tenantId])

**Query Optimization**:
- Use Prisma select/include for controlled data loading
- Implement efficient pagination (offset or cursor-based)
- Multi-field search using OR conditions with ILIKE
- Consider full-text search for future enhancement

**Caching Strategy** (future):
- Cache product master data (5-minute TTL)
- Cache category list (10-minute TTL)
- Invalidate cache on updates

---

## Testing Strategy

### Unit Tests (per module)

**Coverage Target**: 80%+

**Test Cases**:
- Service method logic
- Validation rules
- Business rule enforcement
- Error handling
- Edge cases

**Example Test Structure**:
```typescript
describe('ProductService', () => {
  describe('create', () => {
    it('should create product with valid data');
    it('should throw error for duplicate code');
    it('should validate DEA schedule correlation');
    it('should validate category exists');
  });
});
```

### Integration Tests

**Coverage Target**: 70%+

**Test Cases**:
- Full CRUD operations
- Authentication/authorization
- Tenant isolation
- Pagination
- Search/filter functionality
- Dependency checking

**Example Test**:
```typescript
describe('ProductController (e2e)', () => {
  it('/products (POST) should create product with auth');
  it('/products (GET) should list products for tenant');
  it('/products/:id (DELETE) should prevent delete if batches exist');
});
```

### E2E Tests

**Critical Workflows**:
1. Create category → Create product in category → Verify
2. Create customer with insurance → Validate insurance
3. Create supplier → Link to purchase order (Phase 4)
4. Multi-tenant isolation verification

---

## Implementation Schedule

### Week 4: ProductCategory + Product Foundation

**Days 1-2: ProductCategory Module**
- Create controller, service, module files
- Implement DTOs (WITHOUT code field)
- Implement CRUD operations
- Add tenant isolation
- Write unit tests
- Write integration tests
- API documentation

**Days 3-5: Product Module Foundation**
- Create controller, service, module files
- Implement DTOs (WITHOUT sellingPrice field)
- Implement CRUD operations
- Add enum validations (UnitType, DEASchedule)
- Implement barcode validation
- Add tenant isolation
- Write unit tests

### Week 5: Product Completion + Customer + Supplier

**Days 1-2: Product Module Completion**
- Implement search functionality
- Add category relationship
- Write integration tests
- E2E tests
- API documentation
- Performance testing

**Days 3-4: Customer Module**
- Full CRUD implementation
- Auto-code generation
- Insurance validation
- Allergy structure validation
- Tests
- Documentation

**Day 5: Supplier Module**
- Full CRUD implementation
- Auto-code generation
- Tests
- Documentation

### Week 6: Integration & Polish

**Days 1-2: Integration Testing**
- Cross-module workflows
- Tenant isolation verification
- Performance testing
- Security testing

**Days 3-4: Documentation & Polish**
- Complete API documentation
- Update implementation plan
- Code review
- Bug fixes

**Day 5: Phase 2 Review**
- Demo to stakeholders
- Collect feedback
- Prepare for Phase 3

---

## Dependencies & Integration Points

### Phase 1 Dependencies (Must be completed first)

**Required Modules**:
- Auth module: JWT authentication, role guards
- Tenant module: Tenant context middleware, @CurrentTenant() decorator
- User module: User roles and permissions
- Prisma module: Database access service

**Required Infrastructure**:
- CommonModule: Shared utilities, decorators, guards
- ValidationPipe: Global validation configuration
- Exception filters: Standardized error responses

### Phase 3/4 Integration Points

**Product Module** will be used by:
- Inventory module (3.1): Product batch management
- Sales module (4.1): Product selection during sales
- Prescription module (3.3): Prescription items

**Customer Module** will be used by:
- Sales module (4.1): Customer assignment
- Prescription module (3.3): Patient information

**Supplier Module** will be used by:
- Purchase Order module (4.2): Supplier selection
- ProductBatch module (3.1): Supplier tracking

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Schema discrepancies cause implementation errors | High | Medium | Use schema as source of truth, thorough code review |
| Tenant isolation bugs (data leakage) | Critical | Medium | Comprehensive testing, automated tenant checks |
| Performance issues with large datasets | Medium | Medium | Proper indexing, pagination, query optimization |
| Barcode validation complexity | Low | Low | Use standard barcode libraries |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Code auto-generation conflicts | Medium | Low | Use database transactions, retry logic |
| Cascade delete implications | High | Medium | Dependency checking, soft delete option |
| Insurance validation complexity | Medium | Medium | Simple date-based validation initially |

---

## Success Criteria

### Phase 2 Completion Checklist

**Must-Have**:
- ✅ All CRUD operations working for all 4 modules
- ✅ Tenant isolation verified and tested
- ✅ Authentication/authorization working on all endpoints
- ✅ Basic search/filter functionality implemented
- ✅ Pagination implemented for all list endpoints
- ✅ Unit test coverage >80%
- ✅ Integration tests for critical paths
- ✅ API documentation complete (Swagger)
- ✅ No schema discrepancies in implementation
- ✅ Code review passed
- ✅ Performance benchmarks met

**Nice-to-Have** (Future enhancements):
- 🔄 Advanced search with fuzzy matching
- 🔄 Export to Excel/CSV
- 🔄 Bulk import functionality
- 🔄 Product image upload
- 🔄 Customer/Supplier portal access
- 🔄 Advanced barcode validation (checksums)
- 🔄 Product duplicate detection algorithm

---

## Additional Recommendations

### Code Quality

1. **Follow NestJS best practices**:
   - Use dependency injection
   - Implement DTOs for all inputs
   - Use decorators for validation
   - Separate concerns (controller → service → repository)

2. **Use TypeScript strictly**:
   - Enable strict mode
   - Define interfaces for all data structures
   - Avoid using `any` type

3. **Implement proper error handling**:
   - Use custom exceptions
   - Provide meaningful error messages
   - Include context in errors

### Security

1. **Implement rate limiting** on all endpoints
2. **Sanitize all inputs** to prevent injection attacks
3. **Encrypt sensitive data** (customer allergies, insurance info)
4. **Audit log** all master data changes
5. **Implement HTTPS/TLS** in production

### Monitoring

1. **Log all operations** with appropriate log levels
2. **Monitor API performance** (response times, error rates)
3. **Track tenant usage** for resource allocation
4. **Set up alerts** for critical errors

---

## Appendix A: Complete DTO Examples

### create-product.dto.ts (Complete Example)

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString, IsBoolean, IsEnum, IsInt, IsOptional,
  MinLength, MaxLength, Min, Matches
} from 'class-validator';
import { UnitType, DEASchedule } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product SKU/code (unique per tenant)',
    example: 'PROD-001',
    minLength: 3,
    maxLength: 50
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Z0-9-_]+$/i, {
    message: 'Code must be alphanumeric with dashes or underscores'
  })
  code: string;

  @ApiProperty({
    description: 'Barcode (UPC/EAN)',
    example: '1234567890123',
    required: false
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Aspirin 500mg Tablet',
    minLength: 3,
    maxLength: 200
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Generic/scientific name',
    example: 'Acetylsalicylic Acid',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @ApiProperty({
    description: 'Manufacturer name',
    example: 'Bayer',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @ApiProperty({
    description: 'Product category ID',
    required: false
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: 'Unit type',
    enum: UnitType,
    example: UnitType.TABLET
  })
  @IsEnum(UnitType)
  unitType: UnitType;

  @ApiProperty({
    description: 'Product description',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Requires prescription',
    example: false,
    default: false
  })
  @IsBoolean()
  requiresPrescription: boolean;

  @ApiProperty({
    description: 'DEA controlled substance schedule',
    enum: DEASchedule,
    required: false,
    default: DEASchedule.UNSCHEDULED
  })
  @IsOptional()
  @IsEnum(DEASchedule)
  deaSchedule?: DEASchedule;

  @ApiProperty({
    description: 'Minimum stock level for alerts',
    example: 10,
    minimum: 0,
    default: 0
  })
  @IsInt()
  @Min(0)
  minStockLevel: number;

  @ApiProperty({
    description: 'Active status',
    example: true,
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

---

## Appendix B: Database Query Examples

### Product Search with Multiple Filters

```typescript
async search(query: SearchProductDto, tenantId: string) {
  const {
    search, categoryId, requiresPrescription,
    deaSchedule, isActive, minStock,
    page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc'
  } = query;

  const where = {
    tenantId,
    ...(categoryId && { categoryId }),
    ...(requiresPrescription !== undefined && { requiresPrescription }),
    ...(deaSchedule && { deaSchedule }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } }
      ]
    })
  };

  const [data, total] = await Promise.all([
    this.prisma.product.findMany({
      where,
      include: { category: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    }),
    this.prisma.product.count({ where })
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
```

---

## Document Metadata

- **Version**: 1.0
- **Date**: 2025-01-11
- **Analysis Method**: Sequential thinking with ultrathink mode
- **Schema Source**: prisma/schema.prisma
- **Implementation Plan Source**: docs/core-modules/implementation-plan.md
- **Status**: Ready for Implementation
- **Next Steps**: Begin Week 4 implementation with ProductCategory module

---

**End of Requirements Analysis**
