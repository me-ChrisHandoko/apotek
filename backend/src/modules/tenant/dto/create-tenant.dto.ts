import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create tenant DTO
 */
export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Apotek Sehat Sentosa',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description:
      'Unique tenant code (auto-generated if not provided, uppercase alphanumeric)',
    example: 'PHARM000001',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Tenant code must contain only uppercase letters and numbers',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Tenant settings (JSON object)',
    example: {
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      taxRate: 0.11,
      expiryAlertDays: [30, 60, 90],
    },
  })
  @IsObject()
  @IsOptional()
  settings?: any;
}
