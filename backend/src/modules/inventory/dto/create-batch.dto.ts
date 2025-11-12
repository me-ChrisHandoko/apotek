import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBatchDto {
  @ApiProperty({
    description: 'Product ID for this batch',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Unique batch number for tracking',
    example: 'BATCH-2025-001',
  })
  @IsNotEmpty()
  @IsString()
  batchNumber: string;

  @ApiProperty({
    description: 'Initial quantity in this batch',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Purchase price per unit (in rupiah)',
    example: 50000,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  purchasePrice: number;

  @ApiProperty({
    description: 'Manufacturing date (ISO 8601 format)',
    example: '2025-01-01',
  })
  @IsDateString()
  manufacturingDate: string;

  @ApiProperty({
    description: 'Expiry date - must be after manufacturing date (ISO 8601 format)',
    example: '2026-12-31',
  })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({
    description: 'Supplier lot number for reference',
    example: 'LOT-ABC123',
  })
  @IsOptional()
  @IsString()
  supplierLotNumber?: string;
}
