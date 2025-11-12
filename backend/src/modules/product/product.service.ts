import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { Product, DEASchedule } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto, tenantId: string): Promise<Product> {
    // Validate DEA schedule and prescription requirement correlation
    this.validateDEASchedule(dto.deaSchedule, dto.requiresPrescription);

    // Check if product code already exists for this tenant
    await this.validateCode(dto.code, tenantId);

    // Check if barcode already exists for this tenant (if provided)
    if (dto.barcode) {
      await this.validateBarcode(dto.barcode, tenantId);
    }

    // Validate category exists if provided
    if (dto.categoryId) {
      await this.validateCategoryExists(dto.categoryId, tenantId);
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        tenantId,
        deaSchedule: dto.deaSchedule || DEASchedule.UNSCHEDULED,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(tenantId: string, filter?: SearchProductDto) {
    const {
      search,
      categoryId,
      requiresPrescription,
      deaSchedule,
      isActive,
      minStock,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filter || {};

    const where: any = { tenantId };

    // Multi-field search
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Additional filters
    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (requiresPrescription !== undefined) {
      where.requiresPrescription = requiresPrescription;
    }

    if (deaSchedule) {
      where.deaSchedule = deaSchedule;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          _count: {
            select: { batches: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    // If minStock filter is enabled, filter products below minStockLevel
    let filteredData = data;
    if (minStock) {
      const productsWithStock = await Promise.all(
        data.map(async (product) => {
          const currentStock = await this.getCurrentStockLevel(product.id, tenantId);
          return {
            ...product,
            currentStock,
            isBelowMinStock: currentStock < product.minStockLevel,
          };
        }),
      );

      filteredData = productsWithStock.filter((p) => p.isBelowMinStock);
    }

    return {
      data: filteredData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' },
        },
        _count: {
          select: {
            batches: true,
            saleItems: true,
            prescriptionItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, tenantId: string): Promise<Product> {
    // Verify product exists and belongs to tenant
    await this.findOne(id, tenantId);

    // Validate DEA schedule and prescription requirement correlation if being updated
    if (dto.deaSchedule !== undefined || dto.requiresPrescription !== undefined) {
      const existing = await this.prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (existing) {
        const newDeaSchedule = dto.deaSchedule ?? existing.deaSchedule;
        const newRequiresPrescription =
          dto.requiresPrescription ?? existing.requiresPrescription;

        this.validateDEASchedule(newDeaSchedule, newRequiresPrescription);
      }
    }

    // If code is being updated, check for duplicates
    if (dto.code) {
      await this.validateCode(dto.code, tenantId, id);
    }

    // If barcode is being updated, check for duplicates
    if (dto.barcode) {
      await this.validateBarcode(dto.barcode, tenantId, id);
    }

    // Validate category exists if being updated
    if (dto.categoryId) {
      await this.validateCategoryExists(dto.categoryId, tenantId);
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    // Verify product exists and belongs to tenant
    await this.findOne(id, tenantId);

    // Check dependencies
    const hasDependencies = await this.checkDependencies(id, tenantId);

    if (hasDependencies.hasInventory) {
      throw new ConflictException(
        `Cannot delete product with ${hasDependencies.inventoryCount} inventory batch(es). Please remove or deactivate batches first.`,
      );
    }

    if (hasDependencies.hasSales) {
      throw new ConflictException(
        `Cannot delete product with ${hasDependencies.salesCount} associated sale item(s). Product has sales history.`,
      );
    }

    if (hasDependencies.hasPrescriptions) {
      throw new ConflictException(
        `Cannot delete product with ${hasDependencies.prescriptionCount} associated prescription item(s).`,
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });
  }

  // Validation methods
  async validateCode(code: string, tenantId: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existing) {
      throw new ConflictException(`Product code '${code}' already exists`);
    }
  }

  async validateBarcode(
    barcode: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: {
        tenantId,
        barcode,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existing) {
      throw new ConflictException(`Barcode '${barcode}' already exists`);
    }
  }

  private async validateCategoryExists(
    categoryId: string,
    tenantId: string,
  ): Promise<void> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new BadRequestException(`Category with ID '${categoryId}' not found`);
    }
  }

  private validateDEASchedule(
    deaSchedule: DEASchedule | undefined | null,
    requiresPrescription: boolean,
  ): void {
    // If product has a controlled substance schedule (not UNSCHEDULED),
    // it must require prescription
    if (
      deaSchedule &&
      deaSchedule !== DEASchedule.UNSCHEDULED &&
      !requiresPrescription
    ) {
      throw new BadRequestException(
        `Products with DEA Schedule ${deaSchedule} must require prescription`,
      );
    }
  }

  // Business logic methods
  async checkDependencies(id: string, tenantId: string) {
    const [inventoryCount, salesCount, prescriptionCount] = await Promise.all([
      this.prisma.productBatch.count({
        where: { productId: id, tenantId },
      }),
      this.prisma.saleItem.count({
        where: { productId: id },
      }),
      this.prisma.prescriptionItem.count({
        where: { productId: id },
      }),
    ]);

    return {
      hasInventory: inventoryCount > 0,
      inventoryCount,
      hasSales: salesCount > 0,
      salesCount,
      hasPrescriptions: prescriptionCount > 0,
      prescriptionCount,
    };
  }

  async getCurrentStockLevel(productId: string, tenantId: string): Promise<number> {
    const batches = await this.prisma.productBatch.findMany({
      where: {
        productId,
        tenantId,
        isActive: true,
        expiryDate: { gt: new Date() }, // Only count non-expired batches
      },
      select: {
        currentQuantity: true,
      },
    });

    return batches.reduce((total, batch) => total + batch.currentQuantity, 0);
  }

  async search(query: SearchProductDto, tenantId: string) {
    return this.findAll(tenantId, query);
  }
}
