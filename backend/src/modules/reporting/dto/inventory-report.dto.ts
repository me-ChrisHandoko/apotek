import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ExpiryAlertThreshold {
  DAYS_30 = 30,
  DAYS_60 = 60,
  DAYS_90 = 90,
  DAYS_180 = 180,
}

export class CurrentStockFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Search by product name or code',
    example: 'Paracetamol',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class LowStockFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class ExpiryReportFilterDto {
  @ApiPropertyOptional({
    enum: ExpiryAlertThreshold,
    description: 'Number of days until expiry',
    default: ExpiryAlertThreshold.DAYS_90,
    example: ExpiryAlertThreshold.DAYS_90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(ExpiryAlertThreshold)
  thresholdDays?: ExpiryAlertThreshold = ExpiryAlertThreshold.DAYS_90;

  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class StockValuationFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class DeadStockFilterDto {
  @ApiPropertyOptional({
    description: 'Number of days with no movement to consider dead stock',
    minimum: 30,
    maximum: 365,
    default: 90,
    example: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  daysSinceMovement?: number = 90;

  @ApiPropertyOptional({
    description: 'Filter by product category ID',
    example: 'clxxx123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

// Response DTOs
export class CurrentStockResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  totalQuantity: number;
  minStockLevel: number;
  stockStatus: 'ADEQUATE' | 'LOW' | 'OUT_OF_STOCK';
  activeBatches: number;
}

export class LowStockResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  currentQuantity: number;
  minStockLevel: number;
  shortfall: number;
  daysUntilStockout: number | null;
}

export class ExpiryReportResponseDto {
  batchId: string;
  productId: string;
  productCode: string;
  productName: string;
  batchNumber: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  currentQuantity: number;
  costValue: number;
  sellingValue: number;
}

export class StockValuationResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  totalQuantity: number;
  averageCostPrice: number;
  averageSellingPrice: number;
  totalCostValue: number;
  totalSellingValue: number;
  potentialProfit: number;
}

export class DeadStockResponseDto {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  currentQuantity: number;
  lastMovementDate: Date | null;
  daysSinceMovement: number | null;
  stockValue: number;
}
