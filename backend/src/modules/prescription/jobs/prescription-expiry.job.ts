import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrescriptionService } from '../prescription.service';

@Injectable()
export class PrescriptionExpiryJob {
  private readonly logger = new Logger(PrescriptionExpiryJob.name);

  constructor(
    private prisma: PrismaService,
    private prescriptionService: PrescriptionService,
  ) {}

  /**
   * Run daily at 1:00 AM to expire old prescriptions
   * Runs before expiry alert check (8 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'prescription-expiry-check',
    timeZone: 'Asia/Jakarta',
  })
  async expireOldPrescriptions() {
    this.logger.log('Starting prescription expiry check...');

    try {
      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      this.logger.log(`Processing ${tenants.length} tenants...`);

      let totalExpired = 0;

      // Process each tenant
      for (const tenant of tenants) {
        try {
          const result = await this.prescriptionService.expireOldPrescriptions(
            tenant.id,
          );

          if (result.expiredCount > 0) {
            this.logger.log(
              `Tenant ${tenant.name}: Expired ${result.expiredCount} prescriptions`,
            );
            totalExpired += result.expiredCount;
          }
        } catch (error) {
          this.logger.error(
            `Failed to expire prescriptions for tenant ${tenant.name}: ${error.message}`,
          );
          // Continue with next tenant
        }
      }

      this.logger.log(
        `Prescription expiry check completed. Total expired: ${totalExpired}`,
      );
    } catch (error) {
      this.logger.error(`Prescription expiry job failed: ${error.message}`);
    }
  }
}
