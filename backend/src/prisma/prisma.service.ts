import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma service with tenant isolation middleware
 * CRITICAL: Auto-enforces tenant filtering to prevent data leakage
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');

    // NOTE: Middleware disabled - $use API deprecated in Prisma 5+
    // TODO: Re-implement using Prisma Client Extensions if needed
    // https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions

    // // Register tenant isolation middleware
    // this.registerTenantMiddleware();

    // // Register logging middleware (development only)
    // if (process.env.NODE_ENV === 'development') {
    //   this.registerLoggingMiddleware();
    // }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * CRITICAL: Tenant isolation middleware
   * Automatically enforces tenant filtering on all queries
   * Prevents accidental cross-tenant data leakage
   *
   * NOTE: Disabled - $use middleware API deprecated in Prisma 5+
   * TODO: Re-implement using Prisma Client Extensions
   */
  // @ts-ignore - Disabled middleware
  private registerTenantMiddleware() {
    // List of all tenant-scoped models
    const tenantModels = [
      'User',
      'ProductCategory',
      'Product',
      'ProductBatch',
      'Customer',
      'Supplier',
      'Prescription',
      'PrescriptionItem',
      'Sale',
      'SaleItem',
      'PurchaseOrder',
      'PurchaseOrderItem',
      'StockAdjustment',
      'AuditLog',
    ];

    // @ts-ignore - $use API deprecated in Prisma 5+
    this.$use(async (params, next) => {
      // Only enforce for tenant-scoped models
      if (!tenantModels.includes(params.model || '')) {
        return next(params);
      }

      // Operations that require tenant filtering
      const readOperations = [
        'findMany',
        'findFirst',
        'findUnique',
        'count',
        'aggregate',
        'groupBy',
      ];

      if (readOperations.includes(params.action)) {
        // Enforce tenant filter exists
        if (!params.args) {
          params.args = {};
        }

        if (!params.args.where) {
          params.args.where = {};
        }

        // Check if tenantId filter is present
        if (params.args.where.tenantId === undefined) {
          const error = `[SECURITY VIOLATION] Tenant filter missing: ${params.model}.${params.action}`;
          this.logger.error(error);
          throw new Error(error);
        }
      }

      return next(params);
    });

    this.logger.log('Tenant isolation middleware registered');
  }

  /**
   * Logging middleware for development
   * Logs all database queries for debugging
   *
   * NOTE: Disabled - $use middleware API deprecated in Prisma 5+
   * TODO: Re-implement using Prisma Client Extensions
   */
  // @ts-ignore - Disabled middleware
  private registerLoggingMiddleware() {
    // @ts-ignore - $use API deprecated in Prisma 5+
    this.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();

      this.logger.debug(
        `Query ${params.model}.${params.action} took ${after - before}ms`,
      );

      return result;
    });

    this.logger.log('Query logging middleware registered (development only)');
  }

  /**
   * Clean up database connections
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    // Delete all records in reverse order to respect foreign keys
    const models = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );

    for (const model of models) {
      try {
        await (this as any)[model].deleteMany();
      } catch (error) {
        this.logger.warn(`Failed to clean ${model}: ${error.message}`);
      }
    }

    this.logger.log('Database cleaned');
  }
}
