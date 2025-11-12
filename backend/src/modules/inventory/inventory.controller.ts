import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { StockInquiryDto } from './dto/stock-inquiry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Inventory Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('batches')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Create new product batch',
    description:
      'Create a new batch with expiry tracking. Validates product existence and batch number uniqueness.',
  })
  @ApiResponse({
    status: 201,
    description: 'Batch created successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Batch number already exists' })
  @ApiResponse({ status: 400, description: 'Invalid dates or validation error' })
  createBatch(
    @Body() createBatchDto: CreateBatchDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.createBatch(createBatchDto, tenantId);
  }

  @Get('batches')
  @ApiOperation({
    summary: 'List all product batches',
    description: 'Get paginated list of batches with filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'List of batches retrieved successfully',
  })
  findAllBatches(
    @Query() query: StockInquiryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.findAllBatches(query, tenantId);
  }

  @Get('batches/:id')
  @ApiOperation({
    summary: 'Get batch details',
    description: 'Retrieve detailed information about a specific batch',
  })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Batch details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  findBatchById(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.inventoryService.findBatchById(id, tenantId);
  }

  @Patch('batches/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update batch',
    description: 'Update batch quantity, status, or notes. Cannot reactivate expired batches.',
  })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Batch updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid operation (e.g., reactivating expired batch)',
  })
  updateBatch(
    @Param('id') id: string,
    @Body() updateBatchDto: UpdateBatchDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.updateBatch(id, updateBatchDto, tenantId);
  }

  @Get('stock-levels')
  @ApiOperation({
    summary: 'Get aggregated stock levels',
    description: 'Get current stock levels aggregated from all active batches',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock levels retrieved successfully',
  })
  getStockLevels(
    @Query() query: StockInquiryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.getStockLevels(query, tenantId);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get low stock products',
    description: 'List products below minimum stock level, sorted by deficit',
  })
  @ApiQuery({
    name: 'threshold',
    required: false,
    type: Number,
    description: 'Override default minStockLevel',
  })
  @ApiResponse({
    status: 200,
    description: 'Low stock products retrieved successfully',
  })
  getLowStockProducts(
    @Query('threshold') threshold: number | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.getLowStockProducts(tenantId, threshold);
  }

  @Get('expiring')
  @ApiOperation({
    summary: 'Get expiring batches',
    description: 'List batches expiring within specified days, with severity levels',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Days threshold (default: 30)',
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'Expiring batches retrieved successfully',
  })
  getExpiringBatches(
    @Query('days') days: number = 30,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.getExpiringBatches(days, tenantId);
  }

  @Post('batches/deactivate-expired')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate expired batches',
    description: 'Manually trigger deactivation of all expired batches',
  })
  @ApiResponse({
    status: 200,
    description: 'Expired batches deactivated successfully',
  })
  deactivateExpiredBatches(@CurrentTenant() tenantId: string) {
    return this.inventoryService.deactivateExpiredBatches(tenantId);
  }
}
