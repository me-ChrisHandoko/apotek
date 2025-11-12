import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetadata } from './pagination.dto';

export class ReportMetadata {
  @ApiProperty({ description: 'Type of report generated' })
  reportType: string;

  @ApiProperty({ description: 'Timestamp when report was generated' })
  generatedAt: Date;

  @ApiProperty({ description: 'Tenant ID for the report' })
  tenantId: string;

  @ApiPropertyOptional({ description: 'Applied filters' })
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Pagination information' })
  pagination?: PaginationMetadata;

  @ApiPropertyOptional({ description: 'Aggregate values' })
  aggregates?: Record<string, number | string>;
}

export class ReportResponse<T> {
  @ApiProperty({ description: 'Report data' })
  data: T[];

  @ApiProperty({ description: 'Report metadata', type: ReportMetadata })
  metadata: ReportMetadata;

  constructor(
    data: T[],
    reportType: string,
    tenantId: string,
    filters?: Record<string, any>,
    pagination?: PaginationMetadata,
    aggregates?: Record<string, number | string>,
  ) {
    this.data = data;
    this.metadata = {
      reportType,
      generatedAt: new Date(),
      tenantId,
      filters,
      pagination,
      aggregates,
    };
  }
}
