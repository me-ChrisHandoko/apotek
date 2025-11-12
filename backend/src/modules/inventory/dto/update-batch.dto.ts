import { IsInt, IsPositive, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateBatchDto {
  @ApiPropertyOptional({
    description: 'Update quantity (must be positive)',
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Activate or deactivate batch (cannot reactivate expired batches)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Additional notes for this batch',
    example: 'Stock adjustment due to physical count',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
