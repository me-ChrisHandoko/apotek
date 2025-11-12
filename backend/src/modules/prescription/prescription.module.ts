import { Module } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { PrescriptionItemService } from './prescription-item.service';
import { PrescriptionExpiryJob } from './jobs/prescription-expiry.job';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrescriptionController],
  providers: [
    PrescriptionService,
    PrescriptionItemService,
    PrescriptionExpiryJob,
  ],
  exports: [PrescriptionService, PrescriptionItemService], // Export for Sales module (Phase 4)
})
export class PrescriptionModule {}
