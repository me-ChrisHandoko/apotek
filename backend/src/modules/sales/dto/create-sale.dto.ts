import {
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaleItemDto } from './sale-item.dto';
import { PaymentMethodDto } from './payment-method.dto';

/**
 * DTO for creating a new sale
 *
 * Security Notes:
 * - tenantId is extracted from JWT, not from client input
 * - userId (cashier) is extracted from authenticated user
 * - Prices are NEVER accepted from client
 * - All prices fetched from database for security
 */
export class CreateSaleDto {
  @ApiPropertyOptional({
    description:
      'Customer ID (optional for cash sales, required for insurance)',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description:
      'Prescription ID (required for products with requiresPrescription=true)',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @ApiProperty({
    description: 'Array of items to sell (at least 1 item required)',
    type: [SaleItemDto],
    minimum: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({
    description: 'Array of payment methods (supports multi-payment)',
    type: [PaymentMethodDto],
    minimum: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one payment method is required' })
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  payments: PaymentMethodDto[];

  @ApiPropertyOptional({
    description:
      'Sale-level discount percentage (0-50% without approval, >50% requires manager)',
    minimum: 0,
    maximum: 100,
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Sale-level tax percentage',
    minimum: 0,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional({
    description: 'Notes for this sale',
    example: 'Customer requested delivery',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
