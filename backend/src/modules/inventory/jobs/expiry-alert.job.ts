import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../inventory.service';

@Injectable()
export class ExpiryAlertJob {
  private readonly logger = new Logger(ExpiryAlertJob.name);

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Run daily at 8:00 AM to check for expiring batches
   * Generates alerts at 30/60/90 day thresholds
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    name: 'expiry-alert-check',
    timeZone: 'Asia/Jakarta', // Configure based on deployment
  })
  async checkExpiringBatches() {
    this.logger.log('Starting expiry alert check...');

    try {
      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      this.logger.log(`Processing ${tenants.length} tenants...`);

      let totalAlertsGenerated = 0;

      // Process each tenant
      for (const tenant of tenants) {
        try {
          const alertsForTenant = await this.processExpiryAlertsForTenant(
            tenant.id,
          );
          totalAlertsGenerated += alertsForTenant;
        } catch (error) {
          this.logger.error(
            `Failed to process alerts for tenant ${tenant.name}: ${error.message}`,
          );
          // Continue with next tenant
        }
      }

      this.logger.log(
        `Expiry alert check completed. Total alerts generated: ${totalAlertsGenerated}`,
      );
    } catch (error) {
      this.logger.error(`Expiry alert job failed: ${error.message}`);
    }
  }

  /**
   * Process expiry alerts for a single tenant
   */
  private async processExpiryAlertsForTenant(
    tenantId: string,
  ): Promise<number> {
    let alertCount = 0;

    // Check 30-day threshold (URGENT)
    const urgent = await this.inventoryService.getExpiringBatches(30, tenantId);
    if (urgent.data.length > 0) {
      this.logger.warn(
        `Tenant ${tenantId}: ${urgent.meta.urgentCount} URGENT expiring batches (≤30 days)`,
      );
      // TODO: Send notifications to ADMIN and MANAGER
      // await this.notificationService.sendExpiryAlert(tenantId, urgent, 'URGENT');
      alertCount += urgent.meta.urgentCount;
    }

    // Check 60-day threshold (WARNING)
    const warning = await this.inventoryService.getExpiringBatches(
      60,
      tenantId,
    );
    const warningOnly = warning.data.filter(
      (b) => b.daysUntilExpiry > 30 && b.daysUntilExpiry <= 60,
    );
    if (warningOnly.length > 0) {
      this.logger.log(
        `Tenant ${tenantId}: ${warningOnly.length} WARNING expiring batches (31-60 days)`,
      );
      // TODO: Send notifications
      alertCount += warningOnly.length;
    }

    // Check 90-day threshold (INFO)
    const info = await this.inventoryService.getExpiringBatches(90, tenantId);
    const infoOnly = info.data.filter(
      (b) => b.daysUntilExpiry > 60 && b.daysUntilExpiry <= 90,
    );
    if (infoOnly.length > 0) {
      this.logger.log(
        `Tenant ${tenantId}: ${infoOnly.length} INFO expiring batches (61-90 days)`,
      );
      // TODO: Send notifications
      alertCount += infoOnly.length;
    }

    return alertCount;
  }

  /**
   * Automatically deactivate expired batches
   * Runs daily at 1:00 AM (before expiry alert check)
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'deactivate-expired-batches',
    timeZone: 'Asia/Jakarta',
  })
  async deactivateExpiredBatches() {
    this.logger.log('Starting automatic batch deactivation...');

    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      let totalDeactivated = 0;

      for (const tenant of tenants) {
        try {
          const result = await this.inventoryService.deactivateExpiredBatches(
            tenant.id,
          );
          if (result.deactivatedCount > 0) {
            this.logger.log(
              `Tenant ${tenant.name}: Deactivated ${result.deactivatedCount} expired batches`,
            );
            totalDeactivated += result.deactivatedCount;
          }
        } catch (error) {
          this.logger.error(
            `Failed to deactivate batches for tenant ${tenant.name}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Batch deactivation completed. Total deactivated: ${totalDeactivated}`,
      );
    } catch (error) {
      this.logger.error(`Batch deactivation job failed: ${error.message}`);
    }
  }
}
