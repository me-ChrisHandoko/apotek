import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus, PaymentStatus } from '@prisma/client';
import { BaseReportService } from './base-report.service';
import { DateRangeUtil } from '../utils/date-range.util';
import {
  RevenueSummaryFilterDto,
  ProfitLossByProductFilterDto,
  PaymentCollectionFilterDto,
  OutstandingPaymentsFilterDto,
  RevenueSummaryResponseDto,
  ProfitLossByProductResponseDto,
  PaymentCollectionResponseDto,
  OutstandingPaymentsResponseDto,
  RevenueGroupBy,
} from '../dto/financial-report.dto';
import { ReportResponse } from '../dto/report-response.dto';
import { PaginationDto } from '../dto/pagination.dto';

@Injectable()
export class FinancialReportService extends BaseReportService {
  /**
   * Get revenue summary report
   */
  async getRevenueSummary(
    tenantId: string,
    filterDto: RevenueSummaryFilterDto,
  ): Promise<ReportResponse<RevenueSummaryResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const groupBy = filterDto.groupBy || RevenueGroupBy.DAY;

    // Build status filter
    const statusFilter = filterDto.status
      ? Prisma.sql`AND s.status = ${filterDto.status}::sale_status`
      : Prisma.sql`AND s.status = ${SaleStatus.COMPLETED}::sale_status`;

    // Build date format based on groupBy
    let dateFormat: string;
    switch (groupBy) {
      case RevenueGroupBy.DAY:
        dateFormat = 'YYYY-MM-DD';
        break;
      case RevenueGroupBy.WEEK:
        dateFormat = 'IYYY-IW';
        break;
      case RevenueGroupBy.MONTH:
        dateFormat = 'YYYY-MM';
        break;
    }

    const query = Prisma.sql`
      SELECT
        TO_CHAR(s."saleDate", ${dateFormat}) as period,
        SUM(s.total)::decimal as "totalRevenue",
        SUM(s.discount)::decimal as "totalDiscount",
        SUM(s.tax)::decimal as "totalTax",
        SUM(s.subtotal)::decimal as "netRevenue",
        COUNT(s.id)::int as "transactionCount"
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
        totalRevenue: number;
        totalDiscount: number;
        totalTax: number;
        netRevenue: number;
        transactionCount: number;
      }>
    >(query);

    const data: RevenueSummaryResponseDto[] = results.map((row) => ({
      period: row.period,
      totalRevenue: Number(row.totalRevenue),
      totalDiscount: Number(row.totalDiscount),
      totalTax: Number(row.totalTax),
      netRevenue: Number(row.netRevenue),
      transactionCount: row.transactionCount,
    }));

    // Calculate aggregates
    const aggregates = {
      totalRevenue: data.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalDiscount: data.reduce((sum, item) => sum + item.totalDiscount, 0),
      totalTax: data.reduce((sum, item) => sum + item.totalTax, 0),
      netRevenue: data.reduce((sum, item) => sum + item.netRevenue, 0),
      totalTransactions: data.reduce(
        (sum, item) => sum + item.transactionCount,
        0,
      ),
    };

    return this.createReportResponse(
      data,
      'revenue-summary',
      tenantId,
      { dateRange, groupBy, status: filterDto.status },
      undefined,
      undefined,
      aggregates,
    );
  }

  /**
   * Get profit/loss by product report
   */
  async getProfitLossByProduct(
    tenantId: string,
    filterDto: ProfitLossByProductFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<ProfitLossByProductResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const { skip, take } = this.applyPagination(pagination);

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
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    // Get paginated data with profit calculation
    const query = Prisma.sql`
      SELECT
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        SUM(si.quantity)::int as "totalQuantitySold",
        SUM(si.total)::decimal as "totalRevenue",
        SUM(si.quantity * pb."costPrice")::decimal as "totalCost",
        (SUM(si.total) - SUM(si.quantity * pb."costPrice"))::decimal as "grossProfit",
        CASE
          WHEN SUM(si.total) > 0 THEN
            ((SUM(si.total) - SUM(si.quantity * pb."costPrice")) / SUM(si.total) * 100)::decimal
          ELSE 0
        END as "profitMargin",
        COUNT(DISTINCT s.id)::int as "transactionCount"
      FROM "Product" p
      INNER JOIN "SaleItem" si ON si."productId" = p.id
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "ProductBatch" pb ON pb.id = si."productBatchId"
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        ${statusFilter}
      GROUP BY p.id, p.code, p.name
      ORDER BY "grossProfit" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        productCode: string;
        productName: string;
        totalQuantitySold: number;
        totalRevenue: number;
        totalCost: number;
        grossProfit: number;
        profitMargin: number;
        transactionCount: number;
      }>
    >(query);

    const data: ProfitLossByProductResponseDto[] = results.map((row) => ({
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      totalQuantitySold: row.totalQuantitySold,
      totalRevenue: Number(row.totalRevenue),
      totalCost: Number(row.totalCost),
      grossProfit: Number(row.grossProfit),
      profitMargin: Number(row.profitMargin),
      transactionCount: row.transactionCount,
    }));

    // Calculate aggregates
    const aggregates = {
      totalRevenue: data.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalCost: data.reduce((sum, item) => sum + item.totalCost, 0),
      totalProfit: data.reduce((sum, item) => sum + item.grossProfit, 0),
    };

    return this.createReportResponse(
      data,
      'profit-loss-by-product',
      tenantId,
      { dateRange, status: filterDto.status },
      pagination,
      totalRecords,
      aggregates,
    );
  }

  /**
   * Get payment collection report
   */
  async getPaymentCollection(
    tenantId: string,
    filterDto: PaymentCollectionFilterDto,
  ): Promise<ReportResponse<PaymentCollectionResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);

    // Build payment method filter
    const paymentFilter = filterDto.paymentMethod
      ? Prisma.sql`AND s."paymentMethod" = ${filterDto.paymentMethod}::payment_method`
      : Prisma.empty;

    const query = Prisma.sql`
      SELECT
        TO_CHAR(s."saleDate", 'YYYY-MM-DD') as period,
        s."paymentMethod",
        SUM(s.total)::decimal as "totalCollected",
        COUNT(s.id)::int as "transactionCount"
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        AND s.status = ${SaleStatus.COMPLETED}::sale_status
        ${paymentFilter}
      GROUP BY period, s."paymentMethod"
      ORDER BY period ASC, s."paymentMethod" ASC
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        period: string;
        paymentMethod: string;
        totalCollected: number;
        transactionCount: number;
      }>
    >(query);

    const data: PaymentCollectionResponseDto[] = results.map((row) => ({
      period: row.period,
      paymentMethod: row.paymentMethod as any,
      totalCollected: Number(row.totalCollected),
      transactionCount: row.transactionCount,
    }));

    // Calculate aggregates
    const aggregates = {
      totalCollected: data.reduce((sum, item) => sum + item.totalCollected, 0),
      totalTransactions: data.reduce(
        (sum, item) => sum + item.transactionCount,
        0,
      ),
    };

    return this.createReportResponse(
      data,
      'payment-collection',
      tenantId,
      { dateRange, paymentMethod: filterDto.paymentMethod },
      undefined,
      undefined,
      aggregates,
    );
  }

  /**
   * Get outstanding payments report
   * Uses amountPaid field to calculate actual outstanding amounts
   */
  async getOutstandingPayments(
    tenantId: string,
    filterDto: OutstandingPaymentsFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<OutstandingPaymentsResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const dateRange = DateRangeUtil.resolveDateRange(filterDto);
    const { skip, take } = this.applyPagination(pagination);

    // Count outstanding sales with actual unpaid amounts
    const countQuery = Prisma.sql`
      SELECT COUNT(s.id)::int as count
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        AND s."paymentStatus" IN (${PaymentStatus.PENDING}::payment_status, ${PaymentStatus.PARTIAL}::payment_status)
        AND s.status = ${SaleStatus.COMPLETED}::sale_status
        AND (s.total - s."amountPaid") > 0
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    // Get paginated data with actual amountPaid field
    const query = Prisma.sql`
      SELECT
        s.id as "saleId",
        s."invoiceNumber",
        s."customerId",
        c.name as "customerName",
        s."saleDate",
        s.total as "totalAmount",
        s."amountPaid" as "paidAmount",
        (s.total - s."amountPaid")::decimal as "outstandingAmount",
        DATE_PART('day', CURRENT_DATE - s."saleDate")::int as "daysPastDue"
      FROM "Sale" s
      LEFT JOIN "Customer" c ON c.id = s."customerId"
      WHERE s."tenantId" = ${tenantId}
        AND s."saleDate" >= ${dateRange.startDate}
        AND s."saleDate" <= ${dateRange.endDate}
        AND s."paymentStatus" IN (${PaymentStatus.PENDING}::payment_status, ${PaymentStatus.PARTIAL}::payment_status)
        AND s.status = ${SaleStatus.COMPLETED}::sale_status
        AND (s.total - s."amountPaid") > 0
      ORDER BY s."saleDate" ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        saleId: string;
        invoiceNumber: string;
        customerId: string | null;
        customerName: string | null;
        saleDate: Date;
        totalAmount: number;
        paidAmount: number;
        outstandingAmount: number;
        daysPastDue: number;
      }>
    >(query);

    const data: OutstandingPaymentsResponseDto[] = results.map((row) => ({
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber,
      customerId: row.customerId,
      customerName: row.customerName,
      saleDate: row.saleDate,
      totalAmount: Number(row.totalAmount),
      paidAmount: Number(row.paidAmount),
      outstandingAmount: Number(row.outstandingAmount),
      daysPastDue: row.daysPastDue,
    }));

    // Calculate aggregates
    const aggregates = {
      totalOutstanding: data.reduce(
        (sum, item) => sum + item.outstandingAmount,
        0,
      ),
      totalInvoices: data.length,
    };

    return this.createReportResponse(
      data,
      'outstanding-payments',
      tenantId,
      { dateRange },
      pagination,
      totalRecords,
      aggregates,
    );
  }
}
