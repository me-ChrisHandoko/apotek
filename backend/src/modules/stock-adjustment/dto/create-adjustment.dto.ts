import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AdjustmentType } from '@prisma/client';

export class CreateAdjustmentDto {
  @ApiProperty({
    description: 'Product batch ID to adjust',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsNotEmpty()
  @IsString()
  productBatchId: string;

  @ApiProperty({
    description: 'Type of adjustment',
    enum: AdjustmentType,
    example: AdjustmentType.CORRECTION,
  })
  @IsEnum(AdjustmentType)
  adjustmentType: AdjustmentType;

  @ApiProperty({
    description:
      'Quantity change (positive for increase, negative for decrease). Cannot be zero.',
    example: -10,
  })
  @IsInt()
  @Type(() => Number)
  quantityChange: number;

  @ApiProperty({
    description: 'Reason for adjustment (minimum 10 characters for audit trail)',
    example: 'Physical damage during storage - 10 units broken',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
