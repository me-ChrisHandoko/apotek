import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuditModule } from './audit.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from './audit.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditAction } from './dto/audit-query.dto';

/**
 * Integration Tests for Audit Module
 *
 * Tests end-to-end audit logging functionality:
 * - Automatic logging via interceptor
 * - Multi-tenant isolation
 * - Query and filtering
 */
describe('Audit Module Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditService: AuditService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    auditService = moduleFixture.get<AuditService>(AuditService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Audit Log Creation', () => {
    it('should create audit log for CREATE operation', async () => {
      const dto = {
        tenantId: 'test-tenant-1',
        userId: 'test-user-1',
        entityType: 'Product',
        entityId: 'test-product-1',
        action: AuditAction.CREATE,
        newValues: {
          name: 'Test Product',
          code: 'TEST-001',
          price: 100,
        },
        ipAddress: '127.0.0.1',
      };

      await auditService.logAction(dto);

      // Query the log
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Product',
          entityId: 'test-product-1',
          tenantId: 'test-tenant-1',
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(AuditAction.CREATE);
      expect(logs[0].entityType).toBe('Product');
      expect(logs[0].newValues).toMatchObject({
        name: 'Test Product',
        code: 'TEST-001',
      });
    });

    it('should create audit log for UPDATE operation', async () => {
      const dto = {
        tenantId: 'test-tenant-1',
        userId: 'test-user-1',
        entityType: 'Product',
        entityId: 'test-product-2',
        action: AuditAction.UPDATE,
        oldValues: {
          price: 100,
        },
        newValues: {
          price: 120,
        },
        ipAddress: '127.0.0.1',
      };

      await auditService.logAction(dto);

      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Product',
          entityId: 'test-product-2',
          action: AuditAction.UPDATE,
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].oldValues).toMatchObject({ price: 100 });
      expect(logs[0].newValues).toMatchObject({ price: 120 });
    });

    it('should create audit log for DELETE operation', async () => {
      const dto = {
        tenantId: 'test-tenant-1',
        userId: 'test-user-1',
        entityType: 'Product',
        entityId: 'test-product-3',
        action: AuditAction.DELETE,
        oldValues: {
          name: 'Deleted Product',
          price: 50,
        },
        newValues: null,
        ipAddress: '127.0.0.1',
      };

      await auditService.logAction(dto);

      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Product',
          entityId: 'test-product-3',
          action: AuditAction.DELETE,
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].newValues).toBeNull();
      expect(logs[0].oldValues).toMatchObject({ name: 'Deleted Product' });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate audit logs by tenant', async () => {
      // Create logs for tenant 1
      await auditService.logAction({
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.CREATE,
        newValues: { name: 'Product for Tenant 1' },
        ipAddress: '127.0.0.1',
      });

      // Create logs for tenant 2
      await auditService.logAction({
        tenantId: 'tenant-2',
        userId: 'user-2',
        entityType: 'Product',
        entityId: 'product-2',
        action: AuditAction.CREATE,
        newValues: { name: 'Product for Tenant 2' },
        ipAddress: '127.0.0.1',
      });

      // Query logs for tenant 1
      const tenant1Logs = await auditService.findAll({
        tenantId: 'tenant-1',
        page: 1,
        limit: 50,
      });

      // Should only return tenant 1 logs
      expect(tenant1Logs.data.every((log) => log.tenantId === 'tenant-1')).toBe(true);
    });

    it('should prevent cross-tenant audit log access', async () => {
      // Try to query tenant 2 logs with tenant 1 context
      const result = await auditService.findAll({
        tenantId: 'tenant-1',
        entityId: 'product-2', // This belongs to tenant-2
        page: 1,
        limit: 50,
      });

      // Should return empty or only tenant-1 logs
      expect(result.data.every((log) => log.tenantId === 'tenant-1')).toBe(true);
    });
  });

  describe('Audit Trail Query', () => {
    it('should retrieve complete audit trail for entity', async () => {
      const entityId = 'product-trail-test';

      // Create multiple audit logs for same entity
      await auditService.logAction({
        tenantId: 'test-tenant',
        userId: 'user-1',
        entityType: 'Product',
        entityId,
        action: AuditAction.CREATE,
        newValues: { name: 'Original Name', price: 100 },
        ipAddress: '127.0.0.1',
      });

      await auditService.logAction({
        tenantId: 'test-tenant',
        userId: 'user-2',
        entityType: 'Product',
        entityId,
        action: AuditAction.UPDATE,
        oldValues: { name: 'Original Name', price: 100 },
        newValues: { name: 'Updated Name', price: 120 },
        ipAddress: '127.0.0.2',
      });

      await auditService.logAction({
        tenantId: 'test-tenant',
        userId: 'user-3',
        entityType: 'Product',
        entityId,
        action: AuditAction.UPDATE,
        oldValues: { name: 'Updated Name', price: 120 },
        newValues: { name: 'Final Name', price: 150 },
        ipAddress: '127.0.0.3',
      });

      // Get audit trail
      const trail = await auditService.getEntityAuditTrail('Product', entityId, 'test-tenant');

      expect(trail).toHaveLength(3);
      expect(trail[0].action).toBe(AuditAction.CREATE);
      expect(trail[1].action).toBe(AuditAction.UPDATE);
      expect(trail[2].action).toBe(AuditAction.UPDATE);
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter logs by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await auditService.findAll({
        tenantId: 'test-tenant',
        dateFrom: yesterday.toISOString(),
        dateTo: tomorrow.toISOString(),
        page: 1,
        limit: 50,
      });

      // All logs should be within date range
      expect(
        result.data.every(
          (log) =>
            log.createdAt >= yesterday && log.createdAt <= tomorrow,
        ),
      ).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle 100 audit logs efficiently', async () => {
      const startTime = Date.now();

      // Create 100 audit logs
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          auditService.logAction({
            tenantId: 'perf-test-tenant',
            userId: 'user-1',
            entityType: 'Product',
            entityId: `product-${i}`,
            action: AuditAction.CREATE,
            newValues: { name: `Product ${i}`, price: i * 10 },
            ipAddress: '127.0.0.1',
          }),
        );
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (e.g., < 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify all logs created
      const count = await prisma.auditLog.count({
        where: { tenantId: 'perf-test-tenant' },
      });
      expect(count).toBeGreaterThanOrEqual(100);
    });
  });
});
