import {
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsDateString,
  IsString,
  IsNumber,
  Min,
  IsInt,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReceivePOItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Received quantity', minimum: 0 })
  @IsInt()
  @Min(0)
  receivedQuantity: number;

  @ApiProperty({ description: 'Batch number from supplier' })
  @IsString()
  batchNumber: string;

  @ApiProperty({ description: 'Manufacturing date (ISO format)' })
  @IsDateString()
  manufacturingDate: string;

  @ApiProperty({ description: 'Expiry date (ISO format)' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty({ description: 'Cost price per unit', minimum: 0 })
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiProperty({ description: 'Selling price per unit', minimum: 0 })
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Additional notes for this batch' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ description: 'Purchase Order ID to receive' })
  @IsUUID()
  purchaseOrderId: string;

  @ApiProperty({
    description: 'Array of received items with batch information',
    type: [ReceivePOItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items: ReceivePOItemDto[];
}
