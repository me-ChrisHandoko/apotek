import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { InvoiceGeneratorService } from './utils/invoice-generator.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [SalesController],
  providers: [SalesService, InvoiceGeneratorService],
  exports: [SalesService],
})
export class SalesModule {}
