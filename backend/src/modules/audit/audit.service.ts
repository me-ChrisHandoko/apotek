import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditSanitizer } from './utils/sanitizer';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create audit log entry
   * Handles sanitization and async logging
   */
  async logAction(dto: CreateAuditDto): Promise<void> {
    try {
      // Sanitize old and new values
      const sanitizedOldValues = AuditSanitizer.sanitizeEntity(dto.oldValues);
      const sanitizedNewValues = AuditSanitizer.sanitizeEntity(dto.newValues);

      // Create audit log (fire and forget - non-blocking)
      await this.prisma.auditLog.create({
        data: {
          tenantId: dto.tenantId,
          userId: dto.userId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          action: dto.action,
          oldValues: sanitizedOldValues as Prisma.JsonValue,
          newValues: sanitizedNewValues as Prisma.JsonValue,
          ipAddress: dto.ipAddress,
        },
      });

      this.logger.log(
        `Audit log created: ${dto.entityType}:${dto.entityId} - ${dto.action} by ${dto.userId}`,
      );
    } catch (error) {
      // Log error but don't throw - audit failures should not break business operations
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }

  /**
   * Query audit logs with filters and pagination
   */
  async findAll(query: AuditQueryDto) {
    const { page = 1, limit = 50, ...filters } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.tenantId && { tenantId: filters.tenantId }),
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.entityId && { entityId: filters.entityId }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
    };

    // Add date range filter
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find audit log by ID
   */
  async findOne(id: string, tenantId: string) {
    return this.prisma.auditLog.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
          },
        },
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get audit trail for specific entity
   */
  async getEntityAuditTrail(entityType: string, entityId: string, tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
        tenantId,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get audit statistics for dashboard
   */
  async getStatistics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalLogs, logsByAction, logsByEntity, recentActivity] = await Promise.all([
      // Total logs count
      this.prisma.auditLog.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),

      // Logs by action type
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Logs by entity type
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        _count: true,
        orderBy: {
          _count: {
            entityType: 'desc',
          },
        },
        take: 10,
      }),

      // Recent activity
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              username: true,
              fullName: true,
            },
          },
        },
      }),
    ]);

    return {
      totalLogs,
      logsByAction,
      logsByEntity,
      recentActivity,
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
    };
  }
}
