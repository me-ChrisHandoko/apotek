import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';

export class UpdatePrescriptionDto {
  @ApiPropertyOptional({
    description: 'Update prescription status',
    enum: PrescriptionStatus,
    example: PrescriptionStatus.CANCELLED,
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @ApiPropertyOptional({
    description: 'Update notes',
    example: 'Patient requested cancellation',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Extend validity date (can only extend, not shorten). ISO 8601 format.',
    example: '2025-03-10',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
