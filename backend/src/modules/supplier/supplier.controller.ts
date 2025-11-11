import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

// Note: Import these from Phase 1 when available
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// import { UserRole } from '@prisma/client';

@ApiTags('Suppliers')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard) // Uncomment when Phase 1 guards are available
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly service: SupplierService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Supplier code already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER) // Uncomment when Phase 1 available
  create(
    @Body() dto: CreateSupplierDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List all suppliers' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, code, or contact person' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, example: 'name' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated list of suppliers' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    // @CurrentTenant() tenantId?: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';

    return this.service.findAll(tenantId, {
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('generate-code')
  @ApiOperation({ summary: 'Generate next supplier code' })
  @ApiResponse({ status: 200, description: 'Generated supplier code' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER) // Uncomment when Phase 1 available
  generateCode(
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.generateSupplierCode(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single supplier' })
  @ApiResponse({ status: 200, description: 'Supplier found' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  findOne(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.findOne(id, tenantId);
  }

  @Get(':id/purchase-orders')
  @ApiOperation({ summary: 'Get supplier purchase order history' })
  @ApiResponse({ status: 200, description: 'Purchase order history retrieved' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  getPurchaseOrderHistory(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.getPurchaseOrderHistory(id, tenantId);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get products supplied by this supplier' })
  @ApiResponse({ status: 200, description: 'Supplied products retrieved' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  getSuppliedProducts(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.getSuppliedProducts(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Supplier code already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER) // Uncomment when Phase 1 available
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier deleted successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete supplier with dependencies (batches, purchase orders)',
  })
  // @Roles(UserRole.ADMIN) // Uncomment when Phase 1 available
  async remove(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    await this.service.remove(id, tenantId);
    return { message: 'Supplier deleted successfully' };
  }
}
