import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseReportService } from './base-report.service';
import {
  CurrentStockFilterDto,
  LowStockFilterDto,
  ExpiryReportFilterDto,
  StockValuationFilterDto,
  DeadStockFilterDto,
  CurrentStockResponseDto,
  LowStockResponseDto,
  ExpiryReportResponseDto,
  StockValuationResponseDto,
  DeadStockResponseDto,
} from '../dto/inventory-report.dto';
import { ReportResponse } from '../dto/report-response.dto';
import { PaginationDto } from '../dto/pagination.dto';

@Injectable()
export class InventoryReportService extends BaseReportService {
  /**
   * Get current stock levels
   */
  async getCurrentStock(
    tenantId: string,
    filterDto: CurrentStockFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<CurrentStockResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const { skip, take } = this.applyPagination(pagination);

    // Build filters
    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    const searchFilter = filterDto.search
      ? Prisma.sql`AND (p.name ILIKE ${`%${filterDto.search}%`} OR p.code ILIKE ${`%${filterDto.search}%`})`
      : Prisma.empty;

    // Get total count
    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT p.id)::int as count
      FROM "Product" p
      INNER JOIN "ProductBatch" pb ON pb."productId" = p.id
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND pb."isActive" = true
        ${categoryFilter}
        ${searchFilter}
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
        COALESCE(SUM(pb."currentQuantity"), 0)::int as "totalQuantity",
        p."minStockLevel",
        COUNT(pb.id)::int as "activeBatches",
        CASE
          WHEN COALESCE(SUM(pb."currentQuantity"), 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(SUM(pb."currentQuantity"), 0) <= p."minStockLevel" THEN 'LOW'
          ELSE 'ADEQUATE'
        END as "stockStatus"
      FROM "Product" p
      LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
      LEFT JOIN "ProductBatch" pb ON pb."productId" = p.id AND pb."isActive" = true
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        ${categoryFilter}
        ${searchFilter}
      GROUP BY p.id, p.code, p.name, pc.name, p."minStockLevel"
      ORDER BY "totalQuantity" ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<CurrentStockResponseDto[]>(
      query,
    );

    return this.createReportResponse(
      results,
      'current-stock',
      tenantId,
      { categoryId: filterDto.categoryId, search: filterDto.search },
      pagination,
      totalRecords,
    );
  }

  /**
   * Get low stock alerts
   */
  async getLowStock(
    tenantId: string,
    filterDto: LowStockFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<LowStockResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const { skip, take } = this.applyPagination(pagination);

    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    // Count only products below min stock
    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT p.id)::int as count
      FROM "Product" p
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND COALESCE((
          SELECT SUM(pb."currentQuantity")
          FROM "ProductBatch" pb
          WHERE pb."productId" = p.id AND pb."isActive" = true
        ), 0) <= p."minStockLevel"
        ${categoryFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    const query = Prisma.sql`
      SELECT
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        pc.name as "categoryName",
        COALESCE((
          SELECT SUM(pb."currentQuantity")
          FROM "ProductBatch" pb
          WHERE pb."productId" = p.id AND pb."isActive" = true
        ), 0)::int as "currentQuantity",
        p."minStockLevel",
        (p."minStockLevel" - COALESCE((
          SELECT SUM(pb."currentQuantity")
          FROM "ProductBatch" pb
          WHERE pb."productId" = p.id AND pb."isActive" = true
        ), 0))::int as shortfall
      FROM "Product" p
      LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND COALESCE((
          SELECT SUM(pb."currentQuantity")
          FROM "ProductBatch" pb
          WHERE pb."productId" = p.id AND pb."isActive" = true
        ), 0) <= p."minStockLevel"
        ${categoryFilter}
      ORDER BY shortfall DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<Omit<LowStockResponseDto, 'daysUntilStockout'>>
    >(query);

    const data: LowStockResponseDto[] = results.map((row) => ({
      ...row,
      daysUntilStockout: null, // Requires sales velocity data
    }));

    return this.createReportResponse(
      data,
      'low-stock',
      tenantId,
      { categoryId: filterDto.categoryId },
      pagination,
      totalRecords,
    );
  }

  /**
   * Get expiry report
   */
  async getExpiryReport(
    tenantId: string,
    filterDto: ExpiryReportFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<ExpiryReportResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const { skip, take } = this.applyPagination(pagination);
    const thresholdDays = filterDto.thresholdDays || 90;

    // Calculate threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    const countQuery = Prisma.sql`
      SELECT COUNT(pb.id)::int as count
      FROM "ProductBatch" pb
      INNER JOIN "Product" p ON p.id = pb."productId"
      WHERE pb."tenantId" = ${tenantId}
        AND pb."isActive" = true
        AND pb."currentQuantity" > 0
        AND pb."expiryDate" <= ${thresholdDate}
        AND pb."expiryDate" > CURRENT_DATE
        ${categoryFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    const query = Prisma.sql`
      SELECT
        pb.id as "batchId",
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        pb."batchNumber",
        pb."expiryDate",
        DATE_PART('day', pb."expiryDate" - CURRENT_DATE)::int as "daysUntilExpiry",
        pb."currentQuantity",
        (pb."currentQuantity" * pb."costPrice")::decimal as "costValue",
        (pb."currentQuantity" * pb."sellingPrice")::decimal as "sellingValue"
      FROM "ProductBatch" pb
      INNER JOIN "Product" p ON p.id = pb."productId"
      WHERE pb."tenantId" = ${tenantId}
        AND pb."isActive" = true
        AND pb."currentQuantity" > 0
        AND pb."expiryDate" <= ${thresholdDate}
        AND pb."expiryDate" > CURRENT_DATE
        ${categoryFilter}
      ORDER BY pb."expiryDate" ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        batchId: string;
        productId: string;
        productCode: string;
        productName: string;
        batchNumber: string;
        expiryDate: Date;
        daysUntilExpiry: number;
        currentQuantity: number;
        costValue: number;
        sellingValue: number;
      }>
    >(query);

    const data: ExpiryReportResponseDto[] = results.map((row) => ({
      ...row,
      costValue: Number(row.costValue),
      sellingValue: Number(row.sellingValue),
    }));

    // Calculate aggregates
    const aggregates = {
      totalValue: data.reduce((sum, item) => sum + item.costValue, 0),
      totalBatches: data.length,
    };

    return this.createReportResponse(
      data,
      'expiry-report',
      tenantId,
      { thresholdDays, categoryId: filterDto.categoryId },
      pagination,
      totalRecords,
      aggregates,
    );
  }

  /**
   * Get stock valuation report
   */
  async getStockValuation(
    tenantId: string,
    filterDto: StockValuationFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<StockValuationResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const { skip, take } = this.applyPagination(pagination);

    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT p.id)::int as count
      FROM "Product" p
      INNER JOIN "ProductBatch" pb ON pb."productId" = p.id
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND pb."isActive" = true
        AND pb."currentQuantity" > 0
        ${categoryFilter}
    `;

    const [countResult] = await this.prisma.$queryRaw<[{ count: number }]>(
      countQuery,
    );
    const totalRecords = countResult?.count || 0;

    const query = Prisma.sql`
      SELECT
        p.id as "productId",
        p.code as "productCode",
        p.name as "productName",
        pc.name as "categoryName",
        SUM(pb."currentQuantity")::int as "totalQuantity",
        AVG(pb."costPrice")::decimal as "averageCostPrice",
        AVG(pb."sellingPrice")::decimal as "averageSellingPrice",
        SUM(pb."currentQuantity" * pb."costPrice")::decimal as "totalCostValue",
        SUM(pb."currentQuantity" * pb."sellingPrice")::decimal as "totalSellingValue",
        (SUM(pb."currentQuantity" * pb."sellingPrice") - SUM(pb."currentQuantity" * pb."costPrice"))::decimal as "potentialProfit"
      FROM "Product" p
      LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
      INNER JOIN "ProductBatch" pb ON pb."productId" = p.id
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND pb."isActive" = true
        AND pb."currentQuantity" > 0
        ${categoryFilter}
      GROUP BY p.id, p.code, p.name, pc.name
      ORDER BY "totalCostValue" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        productCode: string;
        productName: string;
        categoryName: string | null;
        totalQuantity: number;
        averageCostPrice: number;
        averageSellingPrice: number;
        totalCostValue: number;
        totalSellingValue: number;
        potentialProfit: number;
      }>
    >(query);

    const data: StockValuationResponseDto[] = results.map((row) => ({
      ...row,
      averageCostPrice: Number(row.averageCostPrice),
      averageSellingPrice: Number(row.averageSellingPrice),
      totalCostValue: Number(row.totalCostValue),
      totalSellingValue: Number(row.totalSellingValue),
      potentialProfit: Number(row.potentialProfit),
    }));

    // Calculate aggregates
    const aggregates = {
      totalInventoryValue: data.reduce(
        (sum, item) => sum + item.totalCostValue,
        0,
      ),
      totalPotentialProfit: data.reduce(
        (sum, item) => sum + item.potentialProfit,
        0,
      ),
    };

    return this.createReportResponse(
      data,
      'stock-valuation',
      tenantId,
      { categoryId: filterDto.categoryId },
      pagination,
      totalRecords,
      aggregates,
    );
  }

  /**
   * Get dead stock report (products with no movement)
   */
  async getDeadStock(
    tenantId: string,
    filterDto: DeadStockFilterDto,
    pagination?: PaginationDto,
  ): Promise<ReportResponse<DeadStockResponseDto>> {
    this.validateTenantAccess(tenantId, tenantId);

    const { skip, take } = this.applyPagination(pagination);
    const daysSinceMovement = filterDto.daysSinceMovement || 90;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceMovement);

    const categoryFilter = filterDto.categoryId
      ? Prisma.sql`AND p."categoryId" = ${filterDto.categoryId}`
      : Prisma.empty;

    // This query finds products with no sales/adjustments after cutoff date
    const query = Prisma.sql`
      WITH product_movement AS (
        SELECT
          p.id as "productId",
          p.code as "productCode",
          p.name as "productName",
          pc.name as "categoryName",
          COALESCE((
            SELECT SUM(pb."currentQuantity")
            FROM "ProductBatch" pb
            WHERE pb."productId" = p.id AND pb."isActive" = true
          ), 0)::int as "currentQuantity",
          GREATEST(
            COALESCE((
              SELECT MAX(s."saleDate")
              FROM "Sale" s
              INNER JOIN "SaleItem" si ON si."saleId" = s.id
              WHERE si."productId" = p.id
            ), '1900-01-01'::timestamp),
            COALESCE((
              SELECT MAX(sa."adjustmentDate")
              FROM "StockAdjustment" sa
              INNER JOIN "ProductBatch" pb ON pb.id = sa."productBatchId"
              WHERE pb."productId" = p.id
            ), '1900-01-01'::timestamp)
          ) as "lastMovementDate"
        FROM "Product" p
        LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
        WHERE p."tenantId" = ${tenantId}
          AND p."isActive" = true
          ${categoryFilter}
      ),
      calculated_movement AS (
        SELECT
          *,
          DATE_PART('day', CURRENT_DATE - "lastMovementDate")::int as "daysSinceMovement",
          (
            SELECT SUM(pb."currentQuantity" * pb."costPrice")
            FROM "ProductBatch" pb
            WHERE pb."productId" = "productId" AND pb."isActive" = true
          )::decimal as "stockValue"
        FROM product_movement
      )
      SELECT
        "productId",
        "productCode",
        "productName",
        "categoryName",
        "currentQuantity",
        "lastMovementDate",
        "daysSinceMovement",
        COALESCE("stockValue", 0) as "stockValue"
      FROM calculated_movement
      WHERE "currentQuantity" > 0
        AND "daysSinceMovement" >= ${daysSinceMovement}
      ORDER BY "daysSinceMovement" DESC, "stockValue" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const results = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        productCode: string;
        productName: string;
        categoryName: string | null;
        currentQuantity: number;
        lastMovementDate: Date | null;
        daysSinceMovement: number | null;
        stockValue: number;
      }>
    >(query);

    const data: DeadStockResponseDto[] = results.map((row) => ({
      ...row,
      stockValue: Number(row.stockValue),
    }));

    // Calculate aggregates
    const aggregates = {
      totalDeadStockValue: data.reduce((sum, item) => sum + item.stockValue, 0),
      totalProducts: data.length,
    };

    return this.createReportResponse(
      data,
      'dead-stock',
      tenantId,
      { daysSinceMovement, categoryId: filterDto.categoryId },
      pagination,
      undefined,
      aggregates,
    );
  }
}
