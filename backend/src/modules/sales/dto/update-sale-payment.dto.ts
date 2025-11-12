import { IsNumber, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class UpdateSalePaymentDto {
  @IsNumber()
  @Min(0.01, { message: 'Additional amount must be greater than 0' })
  additionalAmount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
