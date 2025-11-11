# Pharmacy Management System - API Endpoints Reference

## Base URL Structure
```
Base: /api/v1
Tenant-Scoped: /api/v1/{tenantCode}
```

---

## 🔐 Authentication Module

### Public Endpoints (No Auth Required)
```http
POST   /api/v1/auth/login           # User login
POST   /api/v1/auth/refresh         # Refresh access token
POST   /api/v1/auth/forgot-password # Request password reset
POST   /api/v1/auth/reset-password  # Reset password with token
```

### Protected Endpoints
```http
POST   /api/v1/auth/logout          # User logout
GET    /api/v1/auth/me              # Get current user profile
POST   /api/v1/auth/change-password # Change password
```

---

## 🏢 Tenant Management Module

### Endpoints (ADMIN only)
```http
GET    /api/v1/tenants              # List all tenants
POST   /api/v1/tenants              # Create new tenant
GET    /api/v1/tenants/:id          # Get tenant details
PATCH  /api/v1/tenants/:id          # Update tenant
DELETE /api/v1/tenants/:id          # Deactivate tenant
GET    /api/v1/tenants/:id/settings # Get tenant settings
PATCH  /api/v1/tenants/:id/settings # Update tenant settings
```

---

## 👤 User Management Module

### Endpoints (Tenant-Scoped)
```http
GET    /api/v1/{tenant}/users                # List users
POST   /api/v1/{tenant}/users                # Create user
GET    /api/v1/{tenant}/users/:id            # Get user details
PATCH  /api/v1/{tenant}/users/:id            # Update user
DELETE /api/v1/{tenant}/users/:id            # Deactivate user
PATCH  /api/v1/{tenant}/users/:id/role       # Update user role
PATCH  /api/v1/{tenant}/users/:id/activate   # Activate/deactivate user
```

**Roles**: ADMIN, MANAGER, PHARMACIST, CASHIER

---

## 📁 Product Category Module

### Endpoints
```http
GET    /api/v1/{tenant}/categories           # List categories
POST   /api/v1/{tenant}/categories           # Create category
GET    /api/v1/{tenant}/categories/:id       # Get category
PATCH  /api/v1/{tenant}/categories/:id       # Update category
DELETE /api/v1/{tenant}/categories/:id       # Deactivate category
```

---

## 💊 Product Management Module

### Endpoints
```http
GET    /api/v1/{tenant}/products                    # List products (paginated)
POST   /api/v1/{tenant}/products                    # Create product
GET    /api/v1/{tenant}/products/:id                # Get product details
PATCH  /api/v1/{tenant}/products/:id                # Update product
DELETE /api/v1/{tenant}/products/:id                # Deactivate product
GET    /api/v1/{tenant}/products/search             # Search products
GET    /api/v1/{tenant}/products/barcode/:barcode   # Find by barcode
GET    /api/v1/{tenant}/products/:id/batches        # Get product batches
GET    /api/v1/{tenant}/products/:id/stock          # Get current stock level
GET    /api/v1/{tenant}/products/low-stock          # Get low stock products
```

**Search Parameters**:
- `q` - Search term (code, name, generic name)
- `categoryId` - Filter by category
- `requiresPrescription` - Filter by prescription requirement
- `deaSchedule` - Filter by DEA schedule
- `isActive` - Filter by status

---

## 📦 Inventory Management Module

### Endpoints
```http
GET    /api/v1/{tenant}/inventory                    # List all batches
POST   /api/v1/{tenant}/inventory/batches            # Create batch
GET    /api/v1/{tenant}/inventory/batches/:id        # Get batch details
PATCH  /api/v1/{tenant}/inventory/batches/:id        # Update batch
DELETE /api/v1/{tenant}/inventory/batches/:id        # Deactivate batch
GET    /api/v1/{tenant}/inventory/expiring           # Get expiring batches
GET    /api/v1/{tenant}/inventory/expired            # Get expired batches
GET    /api/v1/{tenant}/inventory/stock-levels       # Aggregated stock levels
GET    /api/v1/{tenant}/inventory/valuation          # Stock valuation report
```

**Expiry Alert Parameters**:
- `days` - Number of days threshold (default: 30)

---

## 🛒 Stock Adjustment Module

### Endpoints
```http
GET    /api/v1/{tenant}/stock-adjustments           # List adjustments
POST   /api/v1/{tenant}/stock-adjustments           # Create adjustment
GET    /api/v1/{tenant}/stock-adjustments/:id       # Get adjustment details
GET    /api/v1/{tenant}/stock-adjustments/batch/:batchId # Batch history
```

**Adjustment Types**: DAMAGE, EXPIRY, THEFT, CORRECTION, RETURN

---

## 👥 Customer Management Module

### Endpoints
```http
GET    /api/v1/{tenant}/customers                   # List customers
POST   /api/v1/{tenant}/customers                   # Create customer
GET    /api/v1/{tenant}/customers/:id               # Get customer details
PATCH  /api/v1/{tenant}/customers/:id               # Update customer
DELETE /api/v1/{tenant}/customers/:id               # Deactivate customer
GET    /api/v1/{tenant}/customers/search            # Search customers
GET    /api/v1/{tenant}/customers/:id/purchases     # Purchase history
GET    /api/v1/{tenant}/customers/:id/prescriptions # Prescription history
```

**Search Parameters**:
- `q` - Search term (code, name, phone)
- `insuranceProvider` - Filter by insurance provider

---

## 🏭 Supplier Management Module

### Endpoints
```http
GET    /api/v1/{tenant}/suppliers                   # List suppliers
POST   /api/v1/{tenant}/suppliers                   # Create supplier
GET    /api/v1/{tenant}/suppliers/:id               # Get supplier details
PATCH  /api/v1/{tenant}/suppliers/:id               # Update supplier
DELETE /api/v1/{tenant}/suppliers/:id               # Deactivate supplier
GET    /api/v1/{tenant}/suppliers/:id/orders        # Purchase order history
```

---

## 📋 Prescription Management Module

### Endpoints
```http
GET    /api/v1/{tenant}/prescriptions                    # List prescriptions
POST   /api/v1/{tenant}/prescriptions                    # Create prescription
GET    /api/v1/{tenant}/prescriptions/:id                # Get prescription
PATCH  /api/v1/{tenant}/prescriptions/:id                # Update prescription
DELETE /api/v1/{tenant}/prescriptions/:id                # Cancel prescription
POST   /api/v1/{tenant}/prescriptions/:id/validate       # Validate prescription
PATCH  /api/v1/{tenant}/prescriptions/:id/status         # Update status
GET    /api/v1/{tenant}/prescriptions/customer/:customerId # Customer prescriptions
GET    /api/v1/{tenant}/prescriptions/active             # Active prescriptions
GET    /api/v1/{tenant}/prescriptions/expiring           # Expiring prescriptions
```

**Statuses**: ACTIVE, DISPENSED, EXPIRED, CANCELLED

---

## 💰 Sales/POS Module

### Endpoints
```http
GET    /api/v1/{tenant}/sales                       # List sales
POST   /api/v1/{tenant}/sales                       # Create sale
GET    /api/v1/{tenant}/sales/:id                   # Get sale details
PATCH  /api/v1/{tenant}/sales/:id/status            # Update sale status
POST   /api/v1/{tenant}/sales/:id/return            # Process return
POST   /api/v1/{tenant}/sales/:id/cancel            # Cancel sale
GET    /api/v1/{tenant}/sales/:id/receipt           # Generate receipt (PDF)
GET    /api/v1/{tenant}/sales/today                 # Today's sales
GET    /api/v1/{tenant}/sales/customer/:customerId  # Customer sales history
```

**Payment Methods**: CASH, CARD, INSURANCE, DIGITAL_WALLET
**Payment Statuses**: PAID, PARTIAL, PENDING
**Sale Statuses**: COMPLETED, CANCELLED, RETURNED

---

## 🛍️ Purchase Order Module

### Endpoints
```http
GET    /api/v1/{tenant}/purchase-orders             # List purchase orders
POST   /api/v1/{tenant}/purchase-orders             # Create PO
GET    /api/v1/{tenant}/purchase-orders/:id         # Get PO details
PATCH  /api/v1/{tenant}/purchase-orders/:id         # Update PO
POST   /api/v1/{tenant}/purchase-orders/:id/receive # Receive PO (creates batches)
POST   /api/v1/{tenant}/purchase-orders/:id/cancel  # Cancel PO
GET    /api/v1/{tenant}/purchase-orders/pending     # Pending POs
GET    /api/v1/{tenant}/purchase-orders/supplier/:supplierId # Supplier POs
```

**Statuses**: PENDING, RECEIVED, CANCELLED

---

## 📊 Reporting Module

### Sales Reports
```http
GET    /api/v1/{tenant}/reports/sales/summary       # Sales summary
GET    /api/v1/{tenant}/reports/sales/by-product    # Sales by product
GET    /api/v1/{tenant}/reports/sales/by-customer   # Sales by customer
GET    /api/v1/{tenant}/reports/sales/by-payment    # Sales by payment method
GET    /api/v1/{tenant}/reports/sales/by-user       # Sales by user (cashier)
GET    /api/v1/{tenant}/reports/sales/top-products  # Top-selling products
```

**Query Parameters**:
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)
- `period` - Predefined period (today, week, month, year)
- `export` - Export format (pdf, excel)

### Inventory Reports
```http
GET    /api/v1/{tenant}/reports/inventory/current   # Current stock levels
GET    /api/v1/{tenant}/reports/inventory/low-stock # Low stock alert
GET    /api/v1/{tenant}/reports/inventory/expiry    # Expiry report
GET    /api/v1/{tenant}/reports/inventory/dead-stock # Dead stock report
GET    /api/v1/{tenant}/reports/inventory/valuation # Stock valuation
```

### Financial Reports
```http
GET    /api/v1/{tenant}/reports/financial/revenue   # Revenue summary
GET    /api/v1/{tenant}/reports/financial/profit    # Profit/loss by product
GET    /api/v1/{tenant}/reports/financial/payments  # Payment collection
GET    /api/v1/{tenant}/reports/financial/outstanding # Outstanding payments
```

### Compliance Reports
```http
GET    /api/v1/{tenant}/reports/compliance/controlled-substances # DEA report
GET    /api/v1/{tenant}/reports/compliance/prescriptions         # Prescription audit
GET    /api/v1/{tenant}/reports/compliance/user-activity         # User activity
```

---

## 📝 Audit Log Module

### Endpoints
```http
GET    /api/v1/{tenant}/audit-logs                  # List audit logs
GET    /api/v1/{tenant}/audit-logs/:id              # Get audit log details
GET    /api/v1/{tenant}/audit-logs/entity/:type/:id # Entity audit history
GET    /api/v1/{tenant}/audit-logs/user/:userId     # User activity logs
GET    /api/v1/{tenant}/audit-logs/export           # Export audit logs
```

**Query Parameters**:
- `entityType` - Filter by entity type (Product, Sale, etc.)
- `action` - Filter by action (CREATE, UPDATE, DELETE, VIEW)
- `startDate` - Start date
- `endDate` - End date
- `userId` - Filter by user

**Audit Actions**: CREATE, UPDATE, DELETE, VIEW

---

## 🔍 Common Query Parameters

### Pagination
```
?page=1              # Page number (default: 1)
?limit=20            # Items per page (default: 20, max: 100)
```

### Sorting
```
?sortBy=createdAt    # Sort field
?sortOrder=desc      # Sort direction (asc/desc)
```

### Filtering
```
?isActive=true       # Filter by active status
?search=query        # General search
```

---

## 📤 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2025-01-11T10:30:00Z"
}
```

---

## 🔒 Authentication & Authorization

### Headers
```http
Authorization: Bearer {access_token}
X-Tenant-Code: {tenant_code}     # Optional, can be in URL
```

### Role-Based Access

| Endpoint Category | ADMIN | MANAGER | PHARMACIST | CASHIER |
|------------------|-------|---------|------------|---------|
| Auth | ✅ | ✅ | ✅ | ✅ |
| Tenant Management | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ |
| Products | ✅ | ✅ | ✅ | 📖 Read |
| Inventory | ✅ | ✅ | ✅ | 📖 Read |
| Customers | ✅ | ✅ | ✅ | ✅ |
| Suppliers | ✅ | ✅ | ❌ | ❌ |
| Prescriptions | ✅ | ✅ | ✅ | 📖 Read |
| Sales | ✅ | ✅ | ✅ | ✅ |
| Purchase Orders | ✅ | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | 📊 Limited | 📊 Limited |
| Audit Logs | ✅ | ✅ | ❌ | ❌ |

**Legend**:
- ✅ Full Access
- 📖 Read-Only
- 📊 Limited Reports
- ❌ No Access

---

## 🎯 Priority Endpoints for MVP

### Critical (Must Have for Launch)
1. `POST /auth/login` - User authentication
2. `GET /auth/me` - Current user
3. `GET /products` - List products
4. `GET /products/barcode/:barcode` - Barcode lookup
5. `POST /sales` - Create sale
6. `GET /inventory/stock-levels` - Check stock
7. `GET /customers` - Customer lookup

### Important (Should Have)
1. `POST /prescriptions` - Create prescription
2. `POST /prescriptions/:id/validate` - Validate prescription
3. `POST /purchase-orders/:id/receive` - Receive stock
4. `GET /reports/sales/summary` - Sales report
5. `GET /inventory/expiring` - Expiry alerts

### Nice to Have
1. `GET /reports/*` - Advanced reports
2. `GET /audit-logs` - Audit trail
3. `POST /sales/:id/receipt` - PDF receipt

---

## 📚 API Documentation

After implementation, generate interactive API documentation using:
- **Swagger/OpenAPI**: Auto-generated from NestJS decorators
- **Postman Collection**: Import/export for testing

**Access Swagger UI**: `http://localhost:3000/api/docs`

---

**Document Version**: 1.0
**Last Updated**: 2025-01-11
