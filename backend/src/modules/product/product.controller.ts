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
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';

// Note: Import these from Phase 1 when available
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// import { UserRole } from '@prisma/client';

@ApiTags('Products')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard) // Uncomment when Phase 1 guards are available
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Product code or barcode already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  create(
    @Body() dto: CreateProductDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List and search products' })
  @ApiResponse({ status: 200, description: 'Paginated list of products' })
  findAll(
    @Query() searchDto: SearchProductDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.findAll(tenantId, searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product with details' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Product code or barcode already exists' })
  // @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST) // Uncomment when Phase 1 available
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete product with dependencies (inventory, sales, prescriptions)',
  })
  // @Roles(UserRole.ADMIN) // Uncomment when Phase 1 available
  async remove(
    @Param('id') id: string,
    // @CurrentTenant() tenantId: string, // Uncomment when Phase 1 available
  ) {
    // Temporary: hardcoded tenantId for testing until Phase 1 is complete
    const tenantId = 'temp-tenant-id';
    await this.service.remove(id, tenantId);
    return { message: 'Product deleted successfully' };
  }
}
