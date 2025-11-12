import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * AuditRetentionJob
 *
 * Implements audit log retention policy:
 * - Default: 7 years (recommended for pharmacy operations)
 * - Minimum: 2 years (DEA requirement for controlled substances)
 * - Method: Soft delete (sets deletedAt timestamp)
 * - Schedule: Monthly on the 1st at midnight
 */
@Injectable()
export class AuditRetentionJob {
  private readonly logger = new Logger(AuditRetentionJob.name);
  private readonly RETENTION_YEARS = parseInt(process.env.AUDIT_RETENTION_YEARS || '7', 10);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run monthly on the 1st at midnight
   * Cron: 0 0 1 * * (second minute hour day month)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleRetentionPolicy() {
    this.logger.log('Starting audit log retention policy execution');

    try {
      // Calculate retention date (current date - retention years)
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() - this.RETENTION_YEARS);

      this.logger.log(
        `Retention policy: ${this.RETENTION_YEARS} years. Archiving logs older than ${retentionDate.toISOString()}`,
      );

      // Soft delete old audit logs
      const result = await this.prisma.auditLog.updateMany({
        where: {
          createdAt: {
            lt: retentionDate,
          },
          deletedAt: null, // Only archive active logs
        },
        data: {
          deletedAt: new Date(),
        },
      });

      this.logger.log(
        `Retention policy completed. Archived ${result.count} audit log(s) older than ${this.RETENTION_YEARS} years`,
      );

      // Optional: Get statistics
      const stats = await this.getRetentionStatistics();
      this.logger.log(
        `Retention statistics - Active: ${stats.activeLogs}, Archived: ${stats.archivedLogs}, Total: ${stats.totalLogs}`,
      );
    } catch (error) {
      this.logger.error(`Retention policy failed: ${error.message}`, error.stack);
      // Don't throw - retention policy should not break the system
    }
  }

  /**
   * Get retention statistics for monitoring
   */
  private async getRetentionStatistics() {
    const [activeLogs, archivedLogs, totalLogs] = await Promise.all([
      this.prisma.auditLog.count({
        where: { deletedAt: null },
      }),
      this.prisma.auditLog.count({
        where: { deletedAt: { not: null } },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      activeLogs,
      archivedLogs,
      totalLogs,
    };
  }

  /**
   * Manual execution for testing or emergency archival
   * Can be called from admin endpoint
   */
  async manualRetentionExecution(yearsOverride?: number) {
    const years = yearsOverride || this.RETENTION_YEARS;
    this.logger.warn(`Manual retention policy execution triggered for ${years} years`);

    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() - years);

    const result = await this.prisma.auditLog.updateMany({
      where: {
        createdAt: {
          lt: retentionDate,
        },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Manual retention completed. Archived ${result.count} log(s)`);
    return result;
  }

  /**
   * Permanently delete archived logs (use with caution)
   * Only for logs that have been archived for a long time
   */
  async permanentlyDeleteArchivedLogs(archivedForYears: number = 1) {
    this.logger.warn(
      `DANGEROUS OPERATION: Permanently deleting logs archived for ${archivedForYears}+ years`,
    );

    const deleteDate = new Date();
    deleteDate.setFullYear(deleteDate.getFullYear() - archivedForYears);

    // Only delete logs that have been archived (deletedAt set) for specified years
    const result = await this.prisma.auditLog.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: deleteDate,
        },
      },
    });

    this.logger.warn(`Permanently deleted ${result.count} archived audit log(s)`);
    return result;
  }
}
