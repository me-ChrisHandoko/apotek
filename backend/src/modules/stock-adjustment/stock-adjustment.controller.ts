import {
  Controller,
  Get,
  Post,
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
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole, AdjustmentType } from '@prisma/client';

@ApiTags('Stock Adjustment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock-adjustments')
export class StockAdjustmentController {
  constructor(
    private readonly stockAdjustmentService: StockAdjustmentService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Create stock adjustment',
    description:
      'Create a stock adjustment for damage, expiry, theft, correction, or return. Updates batch quantity atomically in transaction.',
  })
  @ApiResponse({
    status: 201,
    description: 'Adjustment created successfully',
  })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid adjustment (zero quantity, insufficient stock, inactive batch)',
  })
  createAdjustment(
    @Body() createAdjustmentDto: CreateAdjustmentDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.stockAdjustmentService.createAdjustment(
      createAdjustmentDto,
      userId,
      tenantId,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List all stock adjustments',
    description: 'Get paginated list of adjustments with filtering options',
  })
  @ApiQuery({
    name: 'productBatchId',
    required: false,
    type: String,
    description: 'Filter by batch ID',
  })
  @ApiQuery({
    name: 'adjustmentType',
    required: false,
    enum: AdjustmentType,
    description: 'Filter by adjustment type',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter by start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter by end date (ISO format)',
  })
  @ApiQuery({
    name: 'adjustedBy',
    required: false,
    type: String,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Records per page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'List of adjustments retrieved successfully',
  })
  findAllAdjustments(
    @CurrentTenant() tenantId: string,
    @Query('productBatchId') productBatchId?: string,
    @Query('adjustmentType') adjustmentType?: AdjustmentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('adjustedBy') adjustedBy?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.stockAdjustmentService.findAllAdjustments(
      {
        productBatchId,
        adjustmentType,
        startDate,
        endDate,
        adjustedBy,
        page,
        limit,
      },
      tenantId,
    );
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get adjustment statistics',
    description:
      'Get aggregated adjustment statistics including loss value calculations',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter by start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter by end date (ISO format)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['type', 'product', 'user'],
    description: 'Group results by',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary statistics retrieved successfully',
  })
  getAdjustmentSummary(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'type' | 'product' | 'user',
  ) {
    return this.stockAdjustmentService.getAdjustmentSummary(
      {
        startDate,
        endDate,
        groupBy,
      },
      tenantId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get adjustment details',
    description: 'Retrieve detailed information about a specific adjustment',
  })
  @ApiParam({ name: 'id', description: 'Adjustment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Adjustment details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Adjustment not found' })
  findAdjustmentById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.stockAdjustmentService.findAdjustmentById(id, tenantId);
  }
}
