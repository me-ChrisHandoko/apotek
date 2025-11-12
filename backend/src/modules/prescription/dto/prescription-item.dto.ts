import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsPositive,
  Min,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PrescriptionItemDto {
  @ApiProperty({
    description: 'Product ID for prescribed medication',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Prescribed quantity',
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  prescribedQuantity: number;

  @ApiProperty({
    description: 'Dosage instructions (e.g., "500mg", "2 tablets")',
    example: '500mg',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dosage: string;

  @ApiProperty({
    description: 'Frequency instructions (e.g., "3 times daily after meals")',
    example: '3 times daily after meals',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  frequency: string;

  @ApiProperty({
    description: 'Duration of treatment (e.g., "7 days", "2 weeks")',
    example: '7 days',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  duration: string;

  @ApiPropertyOptional({
    description: 'Special instructions for this medication',
    example: 'Take with food to avoid stomach upset',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
