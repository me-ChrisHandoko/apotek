import {
  IsUUID,
  IsArray,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for returning a sale (full or partial)
 * Uses credit note pattern for partial returns
 */
export class ReturnSaleDto {
  @ApiProperty({
    description: 'Original sale ID to return',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsUUID()
  saleId: string;

  @ApiPropertyOptional({
    description:
      'Array of sale item IDs to return (omit for full return, provide for partial)',
    type: [String],
    example: ['018e8e4a-c7a8-7000-8000-123456789abc'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  itemIds?: string[];

  @ApiProperty({
    description: 'Reason for return',
    example: 'Customer changed mind',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the return',
    example: 'Product in original packaging, good condition',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
