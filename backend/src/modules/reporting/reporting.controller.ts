import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { SalesReportService } from './services/sales-report.service';
import { InventoryReportService } from './services/inventory-report.service';
import { FinancialReportService } from './services/financial-report.service';
import {
  SalesSummaryFilterDto,
  SalesByProductFilterDto,
  SalesByCustomerFilterDto,
  SalesByPaymentMethodFilterDto,
  SalesByUserFilterDto,
  TopSellingProductsFilterDto,
} from './dto/sales-report.dto';
import {
  CurrentStockFilterDto,
  LowStockFilterDto,
  ExpiryReportFilterDto,
  StockValuationFilterDto,
  DeadStockFilterDto,
} from './dto/inventory-report.dto';
import {
  RevenueSummaryFilterDto,
  ProfitLossByProductFilterDto,
  PaymentCollectionFilterDto,
  OutstandingPaymentsFilterDto,
} from './dto/financial-report.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(
    private readonly salesReportService: SalesReportService,
    private readonly inventoryReportService: InventoryReportService,
    private readonly financialReportService: FinancialReportService,
  ) {}

  // ==================== SALES REPORTS ====================

  @Get('sales/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get sales summary report (daily/weekly/monthly)' })
  @ApiResponse({ status: 200, description: 'Sales summary report retrieved' })
  async getSalesSummary(
    @Request() req: any,
    @Query() filterDto: SalesSummaryFilterDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getSalesSummary(tenantId, filterDto);
  }

  @Get('sales/by-product')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get sales by product report' })
  @ApiResponse({ status: 200, description: 'Sales by product report retrieved' })
  async getSalesByProduct(
    @Request() req: any,
    @Query() filterDto: SalesByProductFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getSalesByProduct(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('sales/by-customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get sales by customer report' })
  @ApiResponse({ status: 200, description: 'Sales by customer report retrieved' })
  async getSalesByCustomer(
    @Request() req: any,
    @Query() filterDto: SalesByCustomerFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getSalesByCustomer(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('sales/by-payment-method')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get sales by payment method report' })
  @ApiResponse({
    status: 200,
    description: 'Sales by payment method report retrieved',
  })
  async getSalesByPaymentMethod(
    @Request() req: any,
    @Query() filterDto: SalesByPaymentMethodFilterDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getSalesByPaymentMethod(tenantId, filterDto);
  }

  @Get('sales/by-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get sales by user (cashier) report' })
  @ApiResponse({ status: 200, description: 'Sales by user report retrieved' })
  async getSalesByUser(
    @Request() req: any,
    @Query() filterDto: SalesByUserFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getSalesByUser(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('sales/top-selling')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get top-selling products report' })
  @ApiResponse({
    status: 200,
    description: 'Top-selling products report retrieved',
  })
  async getTopSellingProducts(
    @Request() req: any,
    @Query() filterDto: TopSellingProductsFilterDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.salesReportService.getTopSellingProducts(tenantId, filterDto);
  }

  // ==================== INVENTORY REPORTS ====================

  @Get('inventory/current-stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current stock levels report' })
  @ApiResponse({
    status: 200,
    description: 'Current stock levels report retrieved',
  })
  async getCurrentStock(
    @Request() req: any,
    @Query() filterDto: CurrentStockFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.inventoryReportService.getCurrentStock(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('inventory/low-stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get low stock alerts report' })
  @ApiResponse({ status: 200, description: 'Low stock alerts report retrieved' })
  async getLowStock(
    @Request() req: any,
    @Query() filterDto: LowStockFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.inventoryReportService.getLowStock(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('inventory/expiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get expiring products report' })
  @ApiResponse({
    status: 200,
    description: 'Expiring products report retrieved',
  })
  async getExpiryReport(
    @Request() req: any,
    @Query() filterDto: ExpiryReportFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.inventoryReportService.getExpiryReport(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('inventory/valuation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get stock valuation report' })
  @ApiResponse({ status: 200, description: 'Stock valuation report retrieved' })
  async getStockValuation(
    @Request() req: any,
    @Query() filterDto: StockValuationFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.inventoryReportService.getStockValuation(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('inventory/dead-stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dead stock report' })
  @ApiResponse({ status: 200, description: 'Dead stock report retrieved' })
  async getDeadStock(
    @Request() req: any,
    @Query() filterDto: DeadStockFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.inventoryReportService.getDeadStock(
      tenantId,
      filterDto,
      pagination,
    );
  }

  // ==================== FINANCIAL REPORTS ====================

  @Get('financial/revenue-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get revenue summary report' })
  @ApiResponse({ status: 200, description: 'Revenue summary report retrieved' })
  async getRevenueSummary(
    @Request() req: any,
    @Query() filterDto: RevenueSummaryFilterDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.financialReportService.getRevenueSummary(tenantId, filterDto);
  }

  @Get('financial/profit-loss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get profit/loss by product report' })
  @ApiResponse({
    status: 200,
    description: 'Profit/loss by product report retrieved',
  })
  async getProfitLossByProduct(
    @Request() req: any,
    @Query() filterDto: ProfitLossByProductFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.financialReportService.getProfitLossByProduct(
      tenantId,
      filterDto,
      pagination,
    );
  }

  @Get('financial/payment-collection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment collection report' })
  @ApiResponse({
    status: 200,
    description: 'Payment collection report retrieved',
  })
  async getPaymentCollection(
    @Request() req: any,
    @Query() filterDto: PaymentCollectionFilterDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.financialReportService.getPaymentCollection(
      tenantId,
      filterDto,
    );
  }

  @Get('financial/outstanding-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get outstanding payments report' })
  @ApiResponse({
    status: 200,
    description: 'Outstanding payments report retrieved',
  })
  async getOutstandingPayments(
    @Request() req: any,
    @Query() filterDto: OutstandingPaymentsFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.financialReportService.getOutstandingPayments(
      tenantId,
      filterDto,
      pagination,
    );
  }
}
