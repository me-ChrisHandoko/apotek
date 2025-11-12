import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrescriptionItemDto } from './prescription-item.dto';

export class CreatePrescriptionDto {
  @ApiProperty({
    description: 'Customer (patient) ID',
    example: '018e8e4a-c7a8-7000-8000-123456789abc',
  })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({
    description: 'Prescribing physician name',
    example: 'Dr. John Smith',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  doctorName: string;

  @ApiProperty({
    description: 'Doctor medical license number (required for DEA Schedule substances)',
    example: 'MD-12345-ABC',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'License number must contain only uppercase letters, numbers, and hyphens',
  })
  doctorLicenseNumber: string;

  @ApiProperty({
    description: 'Prescription issue date (ISO 8601 format)',
    example: '2025-01-11',
  })
  @IsDateString()
  issueDate: string;

  @ApiPropertyOptional({
    description:
      'Prescription valid until date (ISO 8601 format). Auto-calculated as issueDate + 30 days if not provided.',
    example: '2025-02-10',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({
    description: 'Special instructions or notes',
    example: 'Patient has allergy to penicillin',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    description: 'List of prescribed medications (minimum 1 item)',
    type: [PrescriptionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @ArrayMinSize(1, { message: 'Prescription must have at least one item' })
  items: PrescriptionItemDto[];
}
