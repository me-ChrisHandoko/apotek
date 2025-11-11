import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Matches,
  IsUUID,
} from 'class-validator';
import { UnitType, DEASchedule } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product SKU/code (unique per tenant)',
    example: 'PROD-001',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Z0-9-_]+$/i, {
    message: 'Code must be alphanumeric with dashes or underscores only',
  })
  code: string;

  @ApiProperty({
    description: 'Barcode (UPC/EAN) - unique per tenant',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Aspirin 500mg Tablet',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Generic/scientific name',
    example: 'Acetylsalicylic Acid',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @ApiProperty({
    description: 'Manufacturer name',
    example: 'Bayer',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @ApiProperty({
    description: 'Product category ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: 'Unit type',
    enum: UnitType,
    example: UnitType.TABLET,
  })
  @IsEnum(UnitType, { message: 'Invalid unit type' })
  unitType: UnitType;

  @ApiProperty({
    description: 'Product description',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Requires prescription',
    example: false,
    default: false,
  })
  @IsBoolean()
  requiresPrescription: boolean;

  @ApiProperty({
    description: 'DEA controlled substance schedule',
    enum: DEASchedule,
    required: false,
    default: DEASchedule.UNSCHEDULED,
  })
  @IsOptional()
  @IsEnum(DEASchedule, { message: 'Invalid DEA schedule' })
  deaSchedule?: DEASchedule;

  @ApiProperty({
    description: 'Minimum stock level for alerts',
    example: 10,
    minimum: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  minStockLevel: number;

  @ApiProperty({
    description: 'Active status',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
