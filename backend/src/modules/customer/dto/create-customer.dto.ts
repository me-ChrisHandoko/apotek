import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AllergyDto {
  @ApiProperty({
    description: 'Allergen name',
    example: 'Penicillin',
  })
  @IsString()
  allergen: string;

  @ApiProperty({
    description: 'Severity level',
    example: 'Severe',
    enum: ['Mild', 'Moderate', 'Severe'],
  })
  @IsString()
  severity: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the allergy',
    example: 'Causes severe rash',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer code (unique per tenant)',
    example: 'CUST-001',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Physical address',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Allergy information',
    type: [AllergyDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies?: AllergyDto[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Insurance fields
  @ApiPropertyOptional({
    description: 'Insurance provider name',
    example: 'Blue Cross',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  insuranceProvider?: string;

  @ApiPropertyOptional({
    description: 'Insurance policy number',
    example: 'BC123456789',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  insurancePolicyNo?: string;

  @ApiPropertyOptional({
    description: 'Insurance group number',
    example: 'GRP-001',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  insuranceGroupNo?: string;

  @ApiPropertyOptional({
    description: 'Insurance expiry date',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({
    description: 'Insurance notes',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  insuranceNotes?: string;

  @ApiPropertyOptional({
    description: 'Active status',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
