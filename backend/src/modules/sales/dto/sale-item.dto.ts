import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a sale item
 * NOTE: Prices are NEVER accepted from client for security reasons
 * Prices are always fetched from database (ProductBatch.sellingPrice)
 */
export class SaleItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity to sell (must be positive)',
    minimum: 1,
    maximum: 10000,
    example: 10,
  })
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(10000, { message: 'Quantity cannot exceed 10000 per item' })
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Item-level discount percentage (0-100). Requires manager approval if > 50%',
    minimum: 0,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Notes for this specific item',
    example: 'Customer requested generic alternative',
  })
  @IsOptional()
  notes?: string;
}
