# Apotek Management System - Backend API

Multi-tenant pharmacy management system built with NestJS, PostgreSQL, and Prisma. Comprehensive inventory, sales, and reporting capabilities with enterprise-grade security.

## 🏗️ Architecture

### Technology Stack
- **Framework**: NestJS 11.x (Node.js/TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens (Argon2id hashing)
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, Rate Limiting, RBAC

### Key Features
- ✅ Multi-tenant architecture with row-level isolation
- ✅ JWT authentication with refresh token rotation
- ✅ Role-based access control (ADMIN, PHARMACIST, CASHIER, MANAGER)
- ✅ Account lockout after 5 failed login attempts
- ✅ Password reset with secure tokens
- ✅ Comprehensive logging and error handling
- ✅ API documentation with Swagger
- ✅ Rate limiting and security headers
- ✅ Global validation and transformation

## 📁 Project Structure

```
src/
├── common/              # Shared utilities and infrastructure
│   ├── decorators/      # Custom decorators (@CurrentUser, @Roles, etc.)
│   ├── dto/            # Base DTOs (pagination, response)
│   ├── filters/        # Exception filters (HTTP, Prisma)
│   ├── guards/         # Auth guards (JWT, Roles, Tenant)
│   ├── interceptors/   # Request/Response interceptors
│   ├── middleware/     # Tenant context middleware
│   └── utils/          # Utility functions (password, token, code-generator)
├── config/             # Configuration and validation
├── modules/            # Feature modules
│   ├── auth/          # Authentication & authorization
│   ├── tenant/        # Tenant management
│   └── user/          # User management
├── prisma/            # Database service
├── app.module.ts      # Root module
└── main.ts            # Application bootstrap
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# IMPORTANT: Change JWT secrets in production!
nano .env
```

4. **Generate JWT secrets** (production)
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

5. **Database setup**
```bash
# Create database
createdb apotek_db

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

6. **Start the application**
```bash
# Development mode with watch
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 🔐 Environment Variables

### Required Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/apotek_db"

# JWT (CRITICAL: Change these!)
JWT_SECRET="minimum-32-characters-strong-random-secret"
JWT_REFRESH_SECRET="different-minimum-32-characters-strong-random-secret"

# Application
NODE_ENV="production"
PORT=3000
```

### Optional Variables
```env
# CORS
CORS_ORIGIN="https://your-frontend.com"

# Email (for password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@example.com"

# Redis (for caching)
REDIS_HOST="localhost"
```

See `.env.example` for complete list.

## 📚 API Documentation

### Access Swagger UI
```
http://localhost:3000/api/docs
```

### API Endpoints

#### Authentication (`/api/v1/auth`)
- `POST /login` - User login
- `POST /register` - User registration
- `POST /logout` - User logout
- `POST /refresh` - Refresh access token
- `POST /password-reset-request` - Request password reset
- `POST /password-reset` - Complete password reset
- `GET /me` - Get current user
- `GET /verify` - Verify token

#### Tenants (`/api/v1/tenants`) - ADMIN only
- `POST /` - Create tenant
- `GET /` - List tenants (paginated)
- `GET /:id` - Get tenant details
- `PATCH /:id` - Update tenant
- `PATCH /:id/deactivate` - Deactivate tenant

#### Users (`/api/v1/users`)
- `POST /` - Create user (ADMIN, MANAGER)
- `GET /` - List users (ADMIN, MANAGER)
- `GET /me` - Get current user profile
- `GET /:id` - Get user details
- `PATCH /:id` - Update user
- `PATCH /:id/password` - Change password
- `PATCH /:id/deactivate` - Deactivate user (ADMIN)
- `PATCH /:id/activate` - Activate user (ADMIN)

## 🔒 Security Features

### Authentication
- **JWT Tokens**: Access token (15min) + Refresh token (7 days)
- **Password Hashing**: Argon2id with secure defaults (OWASP recommended)
- **Account Lockout**: 5 failed attempts → 30 minute lockout
- **Token Rotation**: Refresh tokens rotated on use, revoked on password change

### Authorization
- **Role-Based Access Control**: 4 roles (ADMIN, PHARMACIST, CASHIER, MANAGER)
- **Tenant Isolation**: Row-level security enforced by Prisma middleware
- **Field-Level Permissions**: Users can only update allowed fields

### API Security
- **Rate Limiting**:
  - General: 60 requests/minute
  - Login: 5 attempts/15 minutes
  - Password reset: 3 requests/hour
- **Security Headers**: Helmet middleware
- **CORS**: Configurable allowed origins
- **Input Validation**: Global validation pipe with DTO validation

### Data Protection
- **Tenant Isolation**: CRITICAL Prisma middleware prevents cross-tenant data access
- **Sensitive Data Masking**: Passwords excluded from responses, logs sanitized
- **SQL Injection Protection**: Prisma parameterized queries

## 🏢 Multi-Tenant Usage

### Tenant Identification
The system supports multiple tenant identification methods (priority order):

1. **JWT Token** (recommended)
```bash
Authorization: Bearer <jwt_token>
```

2. **Custom Headers**
```bash
X-Tenant-Code: TENANT001
# or
X-Tenant-Id: 1
```

3. **Subdomain**
```
tenant001.yourdomain.com
```

4. **Query Parameter**
```
?tenantCode=TENANT001
```

### Creating First Tenant

```bash
# Register with tenant creation
POST /api/v1/auth/register
{
  "tenantCode": "TENANT001",
  "tenantName": "My Pharmacy",
  "username": "admin",
  "password": "Admin@123",
  "email": "admin@pharmacy.com",
  "fullName": "Admin User"
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 🛠️ Development Scripts

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Prisma commands
npm run prisma:generate      # Generate Prisma client
npm run prisma:migrate       # Run migrations
npm run prisma:studio        # Open Prisma Studio (database GUI)
npm run prisma:seed          # Seed database
```

## 📊 Database Schema

### Core Tables
- **Tenant**: Multi-tenant organizations
- **User**: System users with RBAC
- **RefreshToken**: JWT refresh tokens
- **PasswordResetToken**: Password reset tokens

### Business Tables (Future Phases)
- Product Categories, Products, Batches
- Customers, Suppliers
- Sales, Transactions
- Inventory adjustments
- Reports

## 🚨 Common Issues

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in .env
# Ensure database exists
createdb apotek_db
```

### JWT Secret Validation Error
```
Error: JWT_SECRET must be at least 32 characters
```
Generate strong secrets using:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Prisma Client Not Generated
```bash
npm run prisma:generate
```

### Port Already in Use
```bash
# Change PORT in .env or kill process
lsof -ti:3000 | xargs kill -9
```

## 📝 Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following existing patterns
3. Run tests: `npm run test`
4. Lint code: `npm run lint`
5. Commit with descriptive message
6. Create pull request

### Code Style
- Follow NestJS conventions
- Use DTOs for request/response
- Add Swagger decorators to all endpoints
- Write comprehensive JSDoc comments
- Use TypeScript strict mode

## 🔄 Phase 1 Implementation Status

### ✅ Completed (Week 1-3)
- [x] Foundation & infrastructure setup
- [x] Authentication & authorization module
- [x] Tenant management module
- [x] User management module
- [x] Security features (JWT, RBAC, account lockout)
- [x] Global error handling and logging
- [x] API documentation with Swagger
- [x] Multi-tenant middleware and isolation

### 📋 Next Phases
- [ ] Phase 2: Product & Inventory Management
- [ ] Phase 3: Customer & Supplier Management
- [ ] Phase 4: Sales & Transactions
- [ ] Phase 5: Reports & Analytics

## 🤝 Contributing

1. Follow the development workflow above
2. Ensure all tests pass
3. Update documentation for new features
4. Follow existing code patterns and conventions

## 📄 License

UNLICENSED - Private project

## 📞 Support

For questions or issues, contact the development team.

---

Built with ❤️ using NestJS and TypeScript
