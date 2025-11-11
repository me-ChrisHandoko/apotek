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
import { ProductCategoryService } from './product-category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Note: Import these from Phase 1 when available
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// import { UserRole } from '@prisma/client';

@ApiTags('Product Categories')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard) // Uncomment when Phase 1 guards are available
@Controller('product-categories')
export class ProductCategoryController {
  constructor(private readonly service: ProductCategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER) // Uncomment when Phase 1 available
  create(
    @Body() dto: CreateCategoryDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List all product categories' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, example: 'name' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated list of categories' })
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product category' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER) // Uncomment when Phase 1 available
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete category with associated products',
  })
  // @Roles(UserRole.ADMIN) // Uncomment when Phase 1 available
  async remove(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    await this.service.remove(id, tenantId);
    return { message: 'Category deleted successfully' };
  }
}
