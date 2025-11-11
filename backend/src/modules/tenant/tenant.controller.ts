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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Tenant Controller
 * Manages tenant operations
 * All endpoints require ADMIN role
 */
@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create new tenant
   * Requires ADMIN role
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ status: 409, description: 'Tenant code already exists' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    const tenant = await this.tenantService.create(createTenantDto);
    return {
      message: 'Tenant created successfully',
      tenant,
    };
  }

  /**
   * Get all tenants with pagination
   * Requires ADMIN role
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  async findAll(@Query() query: TenantQueryDto) {
    return this.tenantService.findAll(query);
  }

  /**
   * Get tenant by ID
   * Requires ADMIN role
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  /**
   * Update tenant
   * Requires ADMIN role
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantService.update(id, updateTenantDto);
    return {
      message: 'Tenant updated successfully',
      tenant,
    };
  }

  /**
   * Deactivate tenant (soft delete)
   * Requires ADMIN role
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate tenant' })
  @ApiResponse({ status: 200, description: 'Tenant deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate tenant with active users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async deactivate(@Param('id') id: string) {
    const tenant = await this.tenantService.deactivate(id);
    return {
      message: 'Tenant deactivated successfully',
      tenant,
    };
  }

  /**
   * Update tenant settings
   * Requires ADMIN role
   */
  @Patch(':id/settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant settings' })
  @ApiResponse({ status: 200, description: 'Tenant settings updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async updateSettings(
    @Param('id') id: string,
    @Body('settings') settings: any,
  ) {
    const tenant = await this.tenantService.updateSettings(id, settings);
    return {
      message: 'Tenant settings updated successfully',
      tenant,
    };
  }

  /**
   * Get cache statistics (development only)
   * Requires ADMIN role
   */
  @Get('cache/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tenant cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  async getCacheStats() {
    return this.tenantService.getCacheStats();
  }

  /**
   * Clear tenant cache (development only)
   * Requires ADMIN role
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clear tenant cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  async clearCache() {
    this.tenantService.clearCache();
    return {
      message: 'Tenant cache cleared successfully',
    };
  }
}
