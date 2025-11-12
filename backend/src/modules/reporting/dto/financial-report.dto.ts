import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DateRangeDto } from './date-range.dto';
import { PaymentMethod, SaleStatus } from '@prisma/client';

export enum RevenueGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export class RevenueSummaryFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: RevenueGroupBy,
    description: 'Group revenue by period',
    example: RevenueGroupBy.DAY,
  })
  @IsOptional()
  @IsEnum(RevenueGroupBy)
  groupBy?: RevenueGroupBy = RevenueGroupBy.DAY;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class ProfitLossByProductFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class PaymentCollectionFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Filter by payment method',
    example: PaymentMethod.CASH,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class OutstandingPaymentsFilterDto extends DateRangeDto {
  // No additional filters needed for now
}

// Response DTOs
export class RevenueSummaryResponseDto {
  period: string;
  totalRevenue: number;
  totalDiscount: number;
  totalTax: number;
  netRevenue: number;
  transactionCount: number;
}

export class ProfitLossByProductResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  transactionCount: number;
}

export class PaymentCollectionResponseDto {
  period: string;
  paymentMethod: PaymentMethod;
  totalCollected: number;
  transactionCount: number;
}

export class OutstandingPaymentsResponseDto {
  saleId: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  saleDate: Date;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysPastDue: number;
}
