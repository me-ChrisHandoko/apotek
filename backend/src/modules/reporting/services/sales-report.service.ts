import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { BaseReportService } from './base-report.service';
import { DateRangeUtil, ResolvedDateRange } from '../utils/date-range.util';
import {
  SalesSummaryFilterDto,
  SalesByProductFilterDto,
  SalesByCustomerFilterDto,
  SalesByPaymentMethodFilterDto,
  SalesByUserFilterDto,
  TopSellingProductsFilterDto,
  SalesSummaryResponseDto,
  SalesByProductResponseDto,
  SalesByCustomerResponseDto,
  SalesByPaymentMethodResponseDto,
  SalesByUserResponseDto,
  TopSellingProductResponseDto,
  SalesSummaryGroupBy,
} from '../dto/sales-report.dto';
import { ReportResponse } from '../dto/report-response.dto';
import { PaginationDto } from '../dto/pagination.dto';

@Injectable()
export class SalesReportService extends BaseReportService {
  /**
   * Get sales summary report (daily/weekly/monthly)
   */
  async getSalesSummary(
    tenantId: string,
    filterDto: SalesSummaryFilterDto,
  ): Promise<ReportResponse<SalesSummaryResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const groupBy = filterDto.groupBy || SalesSummaryGroupBy.DAY;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    // Build date format based on groupBy
    let dateFormat: string;
    switch (groupBy) {
      case SalesSummaryGroupBy.DAY:
        dateFormat = 'YYYY-MM-DD';
        break;
      case SalesSummaryGroupBy.WEEK:
        dateFormat = 'IYYY-IW'; // ISO week format
        break;
      case SalesSummaryGroupBy.MONTH:
        dateFormat = 'YYYY-MM';
        break;
    }

    const query = Prisma.sql`
      SELECT
        TO_CHAR(s."saleDate", ${dateFormat}) as period,
        COUNT(s.id)::int as "transactionCount",
        COALESCE(SUM(s.total), 0)::decimal as "totalRevenue",
        COALESCE(AVG(s.total), 0)::decimal as "averageOrderValue"
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
      GROUP BY period
      ORDER BY period ASC
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        period: string;
        transactionCount: number;
        totalRevenue: number;
        averageOrderValue: number;
      }>
    >(query);

    const data: SalesSummaryResponseDto[] = results.map((row) => ({
      period: row.period,
      totalSales: row.transactionCount,
      totalRevenue: Number(row.totalRevenue),
      averageOrderValue: Number(row.averageOrderValue),
      transactionCount: row.transactionCount,
    }));

    // Calculate aggregates
    const aggregates = {
      totalRevenue: data.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalTransactions: data.reduce(
        (sum, item) => sum + item.transactionCount,
        0,
      ),
      averageOrderValue:
        data.length > 0
          ? data.reduce((sum, item) => sum + item.averageOrderValue, 0) /
            data.length
          : 0,
    };

    return this.createReportResponse(
      data,
      'sales-summary',
      tenantId,
      {
        dateRange,
        groupBy,
        status: filterDto.status,
      },
      undefined,
      undefined,
      aggregates,
    );
  }

  /**
   * Get sales by product report
   */
  async getSalesByProduct(
    tenantId: string,
    filterDto: SalesByProductFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<SalesByProductResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const { skip, take } = this.applyPagination(pagination);

    // Build category filter
    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    // Get total count
    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT p.id)::int as count
      FROM "Product" p
      INNER JOIN "SaleItem" si ON si."productId" = p.id
      INNER JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${categoryFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    // Get paginated data
    const query = Prisma.sql`
      SELECT
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        pc.name as "categoryName",
        SUM(si.quantity)::int as "totalQuantity",
        SUM(si.total)::decimal as "totalRevenue",
        COUNT(DISTINCT s.id)::int as "transactionCount"
      FROM "Product" p
      INNER JOIN "SaleItem" si ON si."productId" = p.id
      INNER JOIN "Sale" s ON s.id = si."saleId"
      LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${categoryFilter}
      GROUP BY p.id, p.code, p.name, pc.name
      ORDER BY "totalRevenue" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<SalesByProductResponseDto[]>(
      query,
    );

    const data = results.map((row) => ({
      ...row,
      totalRevenue: Number(row.totalRevenue),
    }));

    return this.createReportResponse(
      data,
      'sales-by-product',
      tenantId,
      { dateRange, categoryId: filterDto.categoryId, status: filterDto.status },
      pagination,
      totalRecords,
    );
  }

  /**
   * Get sales by customer report
   */
  async getSalesByCustomer(
    tenantId: string,
    filterDto: SalesByCustomerFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<SalesByCustomerResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const { skip, take } = this.applyPagination(pagination);

    // Build customer name filter
    const nameFilter = filterDto.customerName
      ? Prisma.sql`AND c.name ILIKE ${`%${filterDto.customerName}%`}`
      : Prisma.empty;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    // Get total count
    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT c.id)::int as count
      FROM "Customer" c
      INNER JOIN "Sale" s ON s."customerId" = c.id
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${nameFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    // Get paginated data
    const query = Prisma.sql`
      SELECT
        c.id as "customerId",
        c.code as "customerCode",
        c.name as "customerName",
        COUNT(s.id)::int as "transactionCount",
        SUM(s.total)::decimal as "totalSpent",
        MAX(s."saleDate") as "lastPurchaseDate"
      FROM "Customer" c
      INNER JOIN "Sale" s ON s."customerId" = c.id
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${nameFilter}
      GROUP BY c.id, c.code, c.name
      ORDER BY "totalSpent" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        customerId: string;
        customerCode: string;
        customerName: string;
        transactionCount: number;
        totalSpent: number;
        lastPurchaseDate: Date;
      }>
    >(query);

    const data: SalesByCustomerResponseDto[] = results.map((row) => ({
      customerId: row.customerId,
      customerCode: row.customerCode,
      customerName: row.customerName,
      totalPurchases: row.transactionCount,
      totalSpent: Number(row.totalSpent),
      transactionCount: row.transactionCount,
      lastPurchaseDate: row.lastPurchaseDate,
    }));

    return this.createReportResponse(
      data,
      'sales-by-customer',
      tenantId,
      {
        dateRange,
        customerName: filterDto.customerName,
        status: filterDto.status,
      },
      pagination,
      totalRecords,
    );
  }

  /**
   * Get sales by payment method report
   */
  async getSalesByPaymentMethod(
    tenantId: string,
    filterDto: SalesByPaymentMethodFilterDto,
  ): Promise<ReportResponse<SalesByPaymentMethodResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);

    // Build payment method filter
    const paymentFilter = filterDto.paymentMethod
      ? Prisma.sql`AND s."paymentMethod" = ${filterDto.paymentMethod}::payment_method`
      : Prisma.empty;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    const query = Prisma.sql`
      SELECT
        s."paymentMethod",
        COUNT(s.id)::int as "transactionCount",
        SUM(s.total)::decimal as "totalRevenue"
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${paymentFilter}
      GROUP BY s."paymentMethod"
      ORDER BY "totalRevenue" DESC
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        paymentMethod: string;
        transactionCount: number;
        totalRevenue: number;
      }>
    >(query);

    // Calculate total revenue for percentage
    const totalRevenue = results.reduce(
      (sum, row) => sum + Number(row.totalRevenue),
      0,
    );

    const data: SalesByPaymentMethodResponseDto[] = results.map((row) => ({
      paymentMethod: row.paymentMethod as any,
      totalRevenue: Number(row.totalRevenue),
      transactionCount: row.transactionCount,
      percentage:
        totalRevenue > 0
          ? (Number(row.totalRevenue) / totalRevenue) * 100
          : 0,
    }));

    return this.createReportResponse(
      data,
      'sales-by-payment-method',
      tenantId,
      {
        dateRange,
        paymentMethod: filterDto.paymentMethod,
        status: filterDto.status,
      },
      undefined,
      undefined,
      { totalRevenue },
    );
  }

  /**
   * Get sales by user (cashier) report
   */
  async getSalesByUser(
    tenantId: string,
    filterDto: SalesByUserFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<SalesByUserResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const { skip, take } = this.applyPagination(pagination);

    // Build user filter
    const userFilter = filterDto.userId
      ? Prisma.sql`AND u.id = ${filterDto.userId}`
      : Prisma.empty;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    // Get total count
    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT u.id)::int as count
      FROM "User" u
      INNER JOIN "Sale" s ON s."soldBy" = u.id
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${userFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    // Get paginated data
    const query = Prisma.sql`
      SELECT
        u.id as "userId",
        u.username,
        u."fullName",
        COUNT(s.id)::int as "transactionCount",
        SUM(s.total)::decimal as "totalRevenue",
        AVG(s.total)::decimal as "averageOrderValue"
      FROM "User" u
      INNER JOIN "Sale" s ON s."soldBy" = u.id
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
        ${userFilter}
      GROUP BY u.id, u.username, u."fullName"
      ORDER BY "totalRevenue" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        username: string;
        fullName: string;
        transactionCount: number;
        totalRevenue: number;
        averageOrderValue: number;
      }>
    >(query);

    const data: SalesByUserResponseDto[] = results.map((row) => ({
      userId: row.userId,
      username: row.username,
      fullName: row.fullName,
      totalSales: row.transactionCount,
      totalRevenue: Number(row.totalRevenue),
      transactionCount: row.transactionCount,
      averageOrderValue: Number(row.averageOrderValue),
    }));

    return this.createReportResponse(
      data,
      'sales-by-user',
      tenantId,
      { dateRange, userId: filterDto.userId, status: filterDto.status },
      pagination,
      totalRecords,
    );
  }

  /**
   * Get top-selling products report
   */
  async getTopSellingProducts(
    tenantId: string,
    filterDto: TopSellingProductsFilterDto,
  ): Promise<ReportResponse<TopSellingProductResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const limit = filterDto.limit || 10;

    // Build category filter
    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    const query = Prisma.sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY SUM(si.quantity) DESC) as rank,
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        pc.name as "categoryName",
        SUM(si.quantity)::int as "totalQuantitySold",
        SUM(si.total)::decimal as "totalRevenue",
        COUNT(DISTINCT s.id)::int as "transactionCount"
      FROM "Product" p
      INNER JOIN "SaleItem" si ON si."productId" = p.id
      INNER JOIN "Sale" s ON s.id = si."saleId"
      LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        AND s.status = ${SaleStatus.COMPLETED}::sale_status
        ${categoryFilter}
      GROUP BY p.id, p.code, p.name, pc.name
      ORDER BY "totalQuantitySold" DESC
      LIMIT ${limit}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        rank: bigint;
        productId: string;
        productCode: string;
        productName: string;
        categoryName: string | null;
        totalQuantitySold: number;
        totalRevenue: number;
        transactionCount: number;
      }>
    >(query);

    const data: TopSellingProductResponseDto[] = results.map((row) => ({
      rank: Number(row.rank),
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryName: row.categoryName,
      totalQuantitySold: row.totalQuantitySold,
      totalRevenue: Number(row.totalRevenue),
      transactionCount: row.transactionCount,
    }));

    return this.createReportResponse(
      data,
      'top-selling-products',
      tenantId,
      { dateRange, limit, categoryId: filterDto.categoryId },
    );
  }
}
