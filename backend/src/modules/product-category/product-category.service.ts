import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ProductCategory } from '@prisma/client';

@Injectable()
export class ProductCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto, tenantId: string): Promise<ProductCategory> {
    // Check if category name already exists for this tenant
    const existing = await this.prisma.productCategory.findFirst({
      where: {
        tenantId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(`Category with name '${dto.name}' already exists`);
    }

    return this.prisma.productCategory.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(
    tenantId: string,
    options?: {
      search?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = options || {};

    const where: any = { tenantId };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.productCategory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.productCategory.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<ProductCategory> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    tenantId: string,
  ): Promise<ProductCategory> {
    // Verify category exists and belongs to tenant
    await this.findOne(id, tenantId);

    // If name is being updated, check for duplicates
    if (dto.name) {
      const existing = await this.prisma.productCategory.findFirst({
        where: {
          tenantId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Category with name '${dto.name}' already exists`);
      }
    }

    return this.prisma.productCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    // Verify category exists and belongs to tenant
    const category = await this.findOne(id, tenantId);

    // Check if category has products
    const productCount = await this.prisma.product.count({
      where: { categoryId: id, tenantId },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category with ${productCount} associated product(s). Please reassign or delete the products first.`,
      );
    }

    await this.prisma.productCategory.delete({
      where: { id },
    });
  }

  async checkDependencies(id: string, tenantId: string): Promise<boolean> {
    const productCount = await this.prisma.product.count({
      where: { categoryId: id, tenantId },
    });

    return productCount > 0;
  }
}
