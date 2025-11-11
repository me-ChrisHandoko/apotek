import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from '@prisma/client';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupplierDto, tenantId: string): Promise<Supplier> {
    // Check if supplier code already exists for this tenant
    const existing = await this.prisma.supplier.findFirst({
      where: {
        tenantId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(`Supplier code '${dto.code}' already exists`);
    }

    return this.prisma.supplier.create({
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

    // Multi-field search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              productBatches: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            productBatches: true,
            purchaseOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID '${id}' not found`);
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, tenantId: string): Promise<Supplier> {
    // Verify supplier exists and belongs to tenant
    await this.findOne(id, tenantId);

    // If code is being updated, check for duplicates
    if (dto.code) {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          tenantId,
          code: dto.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Supplier code '${dto.code}' already exists`);
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    // Verify supplier exists and belongs to tenant
    const supplier = await this.findOne(id, tenantId);

    // Check dependencies
    const [batchCount, poCount] = await Promise.all([
      this.prisma.productBatch.count({ where: { supplierId: id, tenantId } }),
      this.prisma.purchaseOrder.count({ where: { supplierId: id, tenantId } }),
    ]);

    if (batchCount > 0) {
      throw new ConflictException(
        `Cannot delete supplier with ${batchCount} associated product batch(es).`,
      );
    }

    if (poCount > 0) {
      throw new ConflictException(
        `Cannot delete supplier with ${poCount} associated purchase order(s).`,
      );
    }

    await this.prisma.supplier.delete({
      where: { id },
    });
  }

  async generateSupplierCode(tenantId: string): Promise<string> {
    // Find the last supplier code for this tenant
    const lastSupplier = await this.prisma.supplier.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    if (!lastSupplier) {
      return 'SUP-0001';
    }

    // Extract number from code (assuming format SUP-XXXX)
    const match = lastSupplier.code.match(/\d+$/);
    if (!match) {
      return 'SUP-0001';
    }

    const lastNumber = parseInt(match[0], 10);
    const nextNumber = lastNumber + 1;
    return `SUP-${String(nextNumber).padStart(4, '0')}`;
  }

  async checkDependencies(id: string, tenantId: string) {
    const [batchCount, poCount] = await Promise.all([
      this.prisma.productBatch.count({ where: { supplierId: id, tenantId } }),
      this.prisma.purchaseOrder.count({ where: { supplierId: id, tenantId } }),
    ]);

    return {
      hasBatches: batchCount > 0,
      batchCount,
      hasPurchaseOrders: poCount > 0,
      poCount,
    };
  }

  async getPurchaseOrderHistory(supplierId: string, tenantId: string) {
    await this.findOne(supplierId, tenantId); // Verify supplier exists

    return this.prisma.purchaseOrder.findMany({
      where: { supplierId, tenantId },
      orderBy: { orderDate: 'desc' },
    });
  }

  async getSuppliedProducts(supplierId: string, tenantId: string) {
    await this.findOne(supplierId, tenantId); // Verify supplier exists

    return this.prisma.productBatch.findMany({
      where: { supplierId, tenantId },
      include: {
        product: true,
      },
      orderBy: { receivedDate: 'desc' },
    });
  }
}
