import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ExpiryAlertJob } from './jobs/expiry-alert.job';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, ExpiryAlertJob],
  exports: [InventoryService], // Export for use in other modules (Sales, Stock Adjustment)
})
export class InventoryModule {}
