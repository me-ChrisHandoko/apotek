import { Module } from '@nestjs/common';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StockAdjustmentController],
  providers: [StockAdjustmentService],
  exports: [StockAdjustmentService],
})
export class StockAdjustmentModule {}
