import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { ProductCategoryModule } from './modules/product-category/product-category.module';
import { ProductModule } from './modules/product/product.module';
import { CustomerModule } from './modules/customer/customer.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StockAdjustmentModule } from './modules/stock-adjustment/stock-adjustment.module';
import { PrescriptionModule } from './modules/prescription/prescription.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchaseOrderModule } from './modules/purchase-order/purchase-order.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { validateEnvironment } from './config/env.validation';

/**
 * Root Application Module
 * Orchestrates all modules and global configurations
 */
@Module({
  imports: [
    // Configuration Module (must be first)
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => {
        validateEnvironment();
        return process.env;
      },
    }),

    // Rate Limiting Module
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds
        limit: 60, // 60 requests per minute
      },
      {
        name: 'login',
        ttl: 900000, // 15 minutes
        limit: 5, // 5 login attempts per 15 minutes
      },
      {
        name: 'password-reset',
        ttl: 3600000, // 1 hour
        limit: 3, // 3 password reset requests per hour
      },
    ]),

    // Schedule Module for Cron Jobs
    ScheduleModule.forRoot(),

    // Core Modules
    PrismaModule,
    CommonModule,

    // Phase 1: Foundation & Infrastructure
    AuthModule,
    TenantModule,
    UserModule,

    // Phase 2: Master Data Management
    ProductCategoryModule,
    ProductModule,
    CustomerModule,
    SupplierModule,

    // Phase 3: Inventory & Prescription Management
    InventoryModule,
    StockAdjustmentModule,
    PrescriptionModule,

    // Phase 4: Sales & Purchase Operations
    SalesModule,
    PurchaseOrderModule,

    // Phase 5: Reporting & Analytics
    ReportingModule,
  ],
  controllers: [AppController],
  providers: [
    // Global Exception Filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },

    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },

    // Global Guards (order matters!)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Applied first - validates JWT
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Applied second - validates roles
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware
   * Tenant context middleware applied to all routes
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
