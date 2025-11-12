import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ReportResponse } from '../dto/report-response.dto';
import { PaginationDto, PaginationMetadata } from '../dto/pagination.dto';
import { DateRangeUtil } from '../utils/date-range.util';

@Injectable()
export abstract class BaseReportService {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Validate tenant access
   */
  protected validateTenantAccess(
    requestTenantId: string,
    userTenantId: string,
  ): void {
    if (requestTenantId !== userTenantId) {
      throw new ForbiddenException(
        'You do not have access to this tenant data',
      );
    }
  }

  /**
   * Create pagination metadata
   */
  protected createPaginationMetadata(
    page: number,
    pageSize: number,
    totalRecords: number,
  ): PaginationMetadata {
    const totalPages = DateRangeUtil.calculateTotalPages(
      totalRecords,
      pageSize,
    );

    return {
      page,
      pageSize,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Create report response
   */
  protected createReportResponse<T>(
    data: T[],
    reportType: string,
    tenantId: string,
    filters?: Record<string, any>,
    pagination?: PaginationDto,
    totalRecords?: number,
    aggregates?: Record<string, number | string>,
  ): ReportResponse<T> {
    let paginationMetadata: PaginationMetadata | undefined;

    if (pagination && totalRecords !== undefined) {
      paginationMetadata = this.createPaginationMetadata(
        pagination.page || 1,
        pagination.pageSize || 50,
        totalRecords,
      );
    }

    return new ReportResponse(
      data,
      reportType,
      tenantId,
      filters,
      paginationMetadata,
      aggregates,
    );
  }

  /**
   * Apply pagination to query
   */
  protected applyPagination<T>(pagination?: PaginationDto): {
    skip: number;
    take: number;
  } {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 50;

    return {
      skip: DateRangeUtil.calculateOffset(page, pageSize),
      take: pageSize,
    };
  }
}
