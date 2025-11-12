import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DateRangeDto } from './date-range.dto';
import { PaginationDto } from './pagination.dto';
import { PaymentMethod, SaleStatus } from '@prisma/client';

export enum SalesSummaryGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export class SalesSummaryFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: SalesSummaryGroupBy,
    description: 'Group sales summary by period',
    example: SalesSummaryGroupBy.DAY,
  })
  @IsOptional()
  @IsEnum(SalesSummaryGroupBy)
  groupBy?: SalesSummaryGroupBy = SalesSummaryGroupBy.DAY;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class SalesByProductFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class SalesByCustomerFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Search by customer name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class SalesByPaymentMethodFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Filter by payment method',
    example: PaymentMethod.CASH,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class SalesByUserFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Filter by specific user ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    enum: SaleStatus,
    description: 'Filter by sale status',
    example: SaleStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}

export class TopSellingProductsFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Number of top products to return',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

// Response DTOs
export class SalesSummaryResponseDto {
  period: string; // Date or period identifier
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  transactionCount: number;
}

export class SalesByProductResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  totalQuantity: number;
  totalRevenue: number;
  transactionCount: number;
}

export class SalesByCustomerResponseDto {
  customerId: string;
  customerCode: string;
  customerName: string;
  totalPurchases: number;
  totalSpent: number;
  transactionCount: number;
  lastPurchaseDate: Date;
}

export class SalesByPaymentMethodResponseDto {
  paymentMethod: PaymentMethod;
  totalRevenue: number;
  transactionCount: number;
  percentage: number;
}

export class SalesByUserResponseDto {
  userId: string;
  username: string;
  fullName: string;
  totalSales: number;
  totalRevenue: number;
  transactionCount: number;
  averageOrderValue: number;
}

export class TopSellingProductResponseDto {
  rank: number;
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  totalQuantitySold: number;
  totalRevenue: number;
  transactionCount: number;
}
