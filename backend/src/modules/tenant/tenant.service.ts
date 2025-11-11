import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Tenant } from '@prisma/client';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import {
  PaginatedResponse,
  createPaginationMeta,
  calculateSkip,
} from '../../common/dto/pagination.dto';
import { generateTenantCode } from '../../common/utils/code-generator.util';

/**
 * Tenant Service
 * Manages tenant CRUD operations and tenant context resolution
 */
@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private tenantCache = new Map<string, { tenant: Tenant; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(private prisma: PrismaService) {}

  /**
   * Create new tenant
   * @param createTenantDto - Tenant data
   * @returns Created tenant
   */
  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const { name, code, settings } = createTenantDto;

    // Generate code if not provided
    let tenantCode = code;
    if (!tenantCode) {
      // Count existing tenants to generate sequential code
      const tenantCount = await this.prisma.tenant.count();
      tenantCode = generateTenantCode(tenantCount);
    }

    // Check code uniqueness
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant code already exists');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        code: tenantCode,
        settings: settings || {},
        isActive: true,
      },
    });

    this.logger.log(`Tenant created: ${tenant.code} (ID: ${tenant.id})`);

    return tenant;
  }

  /**
   * Find all tenants with pagination and filtering
   * @param query - Query parameters
   * @returns Paginated tenants
   */
  async findAll(query: TenantQueryDto): Promise<PaginatedResponse<Tenant>> {
    const { page = 1, limit = 20, isActive, search } = query;
    const skip = calculateSkip(page, limit);

    // Build where clause
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.tenant.count({ where });

    // Get tenants
    const tenants = await this.prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const meta = createPaginationMeta(total, page, limit);

    return { items: tenants, meta };
  }

  /**
   * Find tenant by ID
   * @param id - Tenant ID
   * @returns Tenant
   */
  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Find tenant by code (case-insensitive)
   * @param code - Tenant code
   * @returns Tenant or null
   */
  async findByCode(code: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
      },
    });
  }

  /**
   * Update tenant
   * @param id - Tenant ID
   * @param updateTenantDto - Update data
   * @returns Updated tenant
   */
  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    // Validate tenant exists
    const existingTenant = await this.findOne(id);

    // Update tenant
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });

    // Invalidate cache
    this.invalidateCache(existingTenant.code);

    this.logger.log(`Tenant updated: ${tenant.code} (ID: ${tenant.id})`);

    return tenant;
  }

  /**
   * Deactivate tenant (soft delete)
   * @param id - Tenant ID
   * @returns Deactivated tenant
   */
  async deactivate(id: string): Promise<Tenant> {
    // Validate tenant exists
    const tenant = await this.findOne(id);

    // Check if tenant has active users
    const activeUsersCount = await this.prisma.user.count({
      where: {
        tenantId: id,
        isActive: true,
      },
    });

    if (activeUsersCount > 0) {
      throw new BadRequestException(
        'Cannot deactivate tenant with active users',
      );
    }

    // Deactivate tenant
    const deactivated = await this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache
    this.invalidateCache(tenant.code);

    this.logger.warn(`Tenant deactivated: ${tenant.code} (ID: ${tenant.id})`);

    return deactivated;
  }

  /**
   * Update tenant settings
   * @param id - Tenant ID
   * @param settings - Settings JSON
   * @returns Updated tenant
   */
  async updateSettings(id: string, settings: any): Promise<Tenant> {
    const tenant = await this.update(id, { settings });

    this.logger.log(`Tenant settings updated: ${tenant.code} (ID: ${tenant.id})`);

    return tenant;
  }

  /**
   * Get tenant context with caching
   * Used by TenantContextMiddleware
   * @param identifier - Tenant code or ID (string)
   * @returns Tenant context
   */
  async getTenantContext(identifier: string): Promise<Tenant> {
    const cacheKey = identifier;

    // Check cache first
    const cached = this.tenantCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.tenant;
    }

    // Cache miss - query database
    // Try to find by ID first, then by code
    let tenant: Tenant | null = await this.prisma.tenant.findUnique({
      where: { id: identifier },
    });

    if (!tenant) {
      tenant = await this.findByCode(identifier);
    }

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Tenant is inactive');
    }

    // Store in cache
    this.tenantCache.set(cacheKey, {
      tenant,
      timestamp: Date.now(),
    });

    // Also cache by code and ID
    this.tenantCache.set(tenant.id, {
      tenant,
      timestamp: Date.now(),
    });
    this.tenantCache.set(tenant.code, {
      tenant,
      timestamp: Date.now(),
    });

    return tenant;
  }

  /**
   * Invalidate tenant cache
   * @param codeOrId - Tenant code or ID (string)
   */
  private invalidateCache(codeOrId: string): void {
    this.tenantCache.delete(codeOrId);
    this.logger.debug(`Cache invalidated for tenant: ${codeOrId}`);
  }

  /**
   * Clear all tenant cache
   * Use for testing or maintenance
   */
  clearCache(): void {
    this.tenantCache.clear();
    this.logger.log('All tenant cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.tenantCache.size,
      keys: Array.from(this.tenantCache.keys()),
    };
  }
}
