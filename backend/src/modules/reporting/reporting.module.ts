import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReportingController } from './reporting.controller';
import { SalesReportService } from './services/sales-report.service';
import { InventoryReportService } from './services/inventory-report.service';
import { FinancialReportService } from './services/financial-report.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportingController],
  providers: [
    SalesReportService,
    InventoryReportService,
    FinancialReportService,
  ],
  exports: [
    SalesReportService,
    InventoryReportService,
    FinancialReportService,
  ],
})
export class ReportingModule {}
