import { IsEnum, IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

/**
 * DTO for payment method information
 * Supports multiple payment methods per sale
 */
export class PaymentMethodDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    description: 'Amount paid via this payment method',
    minimum: 0,
    example: 50.0,
  })
  @IsNumber()
  @Min(0, { message: 'Payment amount must be non-negative' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Transaction reference (for card/digital wallet payments)',
    example: 'TXN-123456789',
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for this payment',
    example: 'Visa ending in 1234',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
