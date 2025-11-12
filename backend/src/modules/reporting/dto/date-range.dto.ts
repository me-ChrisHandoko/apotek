import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DateRangePeriod {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  THIS_WEEK = 'THIS_WEEK',
  LAST_WEEK = 'LAST_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_QUARTER = 'THIS_QUARTER',
  THIS_YEAR = 'THIS_YEAR',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  CUSTOM = 'CUSTOM',
}

export class DateRangeDto {
  @ApiPropertyOptional({
    enum: DateRangePeriod,
    description: 'Predefined date range period',
    example: DateRangePeriod.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangePeriod)
  period?: DateRangePeriod;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Start date (required if period is CUSTOM)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'End date (required if period is CUSTOM)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
