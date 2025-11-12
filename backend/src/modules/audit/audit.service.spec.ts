import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditAction } from './dto/audit-query.dto';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should create audit log for CREATE operation', async () => {
      const dto: CreateAuditDto = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.CREATE,
        newValues: { name: 'Aspirin', price: 10 },
        ipAddress: '127.0.0.1',
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        ...dto,
        createdAt: new Date(),
      });

      await service.logAction(dto);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: dto.tenantId,
            userId: dto.userId,
            entityType: dto.entityType,
            entityId: dto.entityId,
            action: dto.action,
            ipAddress: dto.ipAddress,
          }),
        }),
      );
    });

    it('should handle null oldValues for CREATE operation', async () => {
      const dto: CreateAuditDto = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: { name: 'Aspirin' },
        ipAddress: '127.0.0.1',
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        ...dto,
        createdAt: new Date(),
      });

      await service.logAction(dto);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should handle null newValues for DELETE operation', async () => {
      const dto: CreateAuditDto = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.DELETE,
        oldValues: { name: 'Aspirin', price: 10 },
        newValues: null,
        ipAddress: '127.0.0.1',
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        ...dto,
        createdAt: new Date(),
      });

      await service.logAction(dto);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should not throw error if audit logging fails', async () => {
      const dto: CreateAuditDto = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.CREATE,
        newValues: { name: 'Aspirin' },
        ipAddress: '127.0.0.1',
      };

      mockPrismaService.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.logAction(dto)).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should query audit logs with filters', async () => {
      const query = {
        tenantId: 'tenant-1',
        entityType: 'Product',
        page: 1,
        limit: 50,
      };

      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          entityType: 'Product',
          entityId: 'product-1',
          action: AuditAction.CREATE,
          createdAt: new Date(),
          user: { id: 'user-1', username: 'admin', fullName: 'Admin User', role: 'ADMIN' },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockLogs);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
    });

    it('should apply date range filter', async () => {
      const query = {
        tenantId: 'tenant-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 1,
        limit: 50,
      };

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should find audit log by ID and tenant', async () => {
      const mockLog = {
        id: 'audit-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'Product',
        entityId: 'product-1',
        action: AuditAction.CREATE,
        createdAt: new Date(),
        user: { id: 'user-1', username: 'admin', fullName: 'Admin User', role: 'ADMIN' },
        tenant: { id: 'tenant-1', code: 'MAIN', name: 'Main Pharmacy' },
      };

      mockPrismaService.auditLog.findFirst.mockResolvedValue(mockLog);

      const result = await service.findOne('audit-1', 'tenant-1');

      expect(result).toEqual(mockLog);
      expect(mockPrismaService.auditLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'audit-1', tenantId: 'tenant-1' },
        }),
      );
    });
  });

  describe('getEntityAuditTrail', () => {
    it('should retrieve complete audit trail for entity', async () => {
      const mockTrail = [
        {
          id: 'audit-1',
          action: AuditAction.CREATE,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'audit-2',
          action: AuditAction.UPDATE,
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockTrail);

      const result = await service.getEntityAuditTrail('Product', 'product-1', 'tenant-1');

      expect(result).toEqual(mockTrail);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: 'Product',
            entityId: 'product-1',
            tenantId: 'tenant-1',
          },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return audit statistics', async () => {
      mockPrismaService.auditLog.count.mockResolvedValue(100);
      mockPrismaService.auditLog.groupBy
        .mockResolvedValueOnce([
          { action: 'CREATE', _count: 50 },
          { action: 'UPDATE', _count: 30 },
          { action: 'DELETE', _count: 20 },
        ])
        .mockResolvedValueOnce([
          { entityType: 'Product', _count: 60 },
          { entityType: 'Sale', _count: 40 },
        ]);
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getStatistics('tenant-1', 30);

      expect(result.totalLogs).toBe(100);
      expect(result.logsByAction).toHaveLength(3);
      expect(result.logsByEntity).toHaveLength(2);
      expect(result.period.days).toBe(30);
    });
  });
});
