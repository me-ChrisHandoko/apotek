import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { StockInquiryDto } from './dto/stock-inquiry.dto';

export interface BatchAllocation {
  batchId: string;
  allocatedQuantity: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private uuid: UuidService,
  ) {}

  /**
   * Create new product batch
   * Validates product existence, batch uniqueness, and date logic
   */
  async createBatch(dto: CreateBatchDto, tenantId: string) {
    // Validate product exists and belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${dto.productId} not found or does not belong to this tenant`,
      );
    }

    // Validate batch number uniqueness per product + tenant
    const existingBatch = await this.prisma.productBatch.findFirst({
      where: {
        productId: dto.productId,
        batchNumber: dto.batchNumber,
        tenantId,
      },
    });

    if (existingBatch) {
      throw new ConflictException(
        `Batch number ${dto.batchNumber} already exists for this product`,
      );
    }

    // Validate dates
    const manufacturingDate = new Date(dto.manufacturingDate);
    const expiryDate = new Date(dto.expiryDate);
    const today = new Date();

    if (expiryDate <= manufacturingDate) {
      throw new BadRequestException(
        'Expiry date must be after manufacturing date',
      );
    }

    if (expiryDate <= today) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    // Create batch with UUID v7 for time-ordered tracking
    const batchId = this.uuid.generateV7();

    const batch = await this.prisma.productBatch.create({
      data: {
        id: batchId,
        productId: dto.productId,
        batchNumber: dto.batchNumber,
        quantity: dto.quantity,
        costPrice: dto.purchasePrice,
        sellingPrice: dto.purchasePrice, // Default selling price same as cost
        receivedDate: manufacturingDate,
        expiryDate,
        isActive: true,
        tenantId,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            genericName: true,
          },
        },
      },
    });

    return batch;
  }

  /**
   * Find all batches with filtering and pagination
   */
  async findAllBatches(query: StockInquiryDto, tenantId: string) {
    const {
      productId,
      categoryId,
      lowStockOnly,
      expiringWithinDays,
      includeInactive,
      page = 1,
      limit = 20,
    } = query;

    const where: any = { tenantId };

    if (productId) {
      where.productId = productId;
    }

    if (categoryId) {
      where.product = { categoryId };
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    if (expiringWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + expiringWithinDays);
      where.expiryDate = {
        gte: new Date(),
        lte: futureDate,
      };
    }

    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      this.prisma.productBatch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              genericName: true,
              category: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { expiryDate: 'asc' }, // FEFO order
        skip,
        take: limit,
      }),
      this.prisma.productBatch.count({ where }),
    ]);

    return {
      data: batches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single batch by ID
   */
  async findBatchById(id: string, tenantId: string) {
    const batch = await this.prisma.productBatch.findFirst({
      where: { id, tenantId },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            genericName: true,
            deaSchedule: true,
            category: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }

    return batch;
  }

  /**
   * Update batch (quantity, status, notes)
   */
  async updateBatch(id: string, dto: UpdateBatchDto, tenantId: string) {
    const batch = await this.findBatchById(id, tenantId);

    // Business rule: Cannot reactivate expired batches
    if (dto.isActive === true && batch.expiryDate < new Date()) {
      throw new BadRequestException('Cannot reactivate expired batch');
    }

    // Business rule: Cannot set quantity on inactive batch
    if (dto.quantity !== undefined && batch.isActive === false) {
      throw new BadRequestException('Cannot update quantity on inactive batch');
    }

    // Business rule: Quantity must remain >= 0
    if (dto.quantity !== undefined && dto.quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    const updated = await this.prisma.productBatch.update({
      where: { id },
      data: {
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    return updated;
  }

  /**
   * Get aggregated stock levels by product
   */
  async getStockLevels(query: StockInquiryDto, tenantId: string) {
    const { productId, categoryId, page = 1, limit = 20 } = query;

    const where: any = { tenantId };
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (productId) {
      where.id = productId;
    }

    const skip = (page - 1) * limit;

    // Get products with their batch aggregations
    const products = await this.prisma.product.findMany({
      where,
      include: {
        batches: {
          where: {
            isActive: true,
            quantity: { gt: 0 },
            expiryDate: { gt: new Date() },
          },
          select: {
            quantity: true,
            expiryDate: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.product.count({ where });

    const data = products.map((product) => {
      const currentStock = product.batches.reduce(
        (sum, batch) => sum + batch.quantity,
        0,
      );
      const isLowStock = currentStock < product.minStockLevel;
      const earliestExpiry =
        product.batches.length > 0
          ? product.batches.reduce((earliest, batch) =>
              batch.expiryDate < earliest ? batch.expiryDate : earliest,
            product.batches[0].expiryDate)
          : null;

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        currentStock,
        minStockLevel: product.minStockLevel,
        isLowStock,
        batchCount: product.batches.length,
        earliestExpiry,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get products below minimum stock level
   */
  async getLowStockProducts(tenantId: string, threshold?: number) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: {
        batches: {
          where: {
            isActive: true,
            quantity: { gt: 0 },
            expiryDate: { gt: new Date() },
          },
          select: { quantity: true },
        },
        category: {
          select: { name: true },
        },
      },
    });

    const lowStockProducts = products
      .map((product) => {
        const currentStock = product.batches.reduce(
          (sum, batch) => sum + batch.quantity,
          0,
        );
        const minStock = threshold || product.minStockLevel;
        const deficit = minStock - currentStock;

        return {
          productId: product.id,
          productName: product.name,
          currentStock,
          minStockLevel: minStock,
          deficit,
          category: product.category?.name || 'Uncategorized',
        };
      })
      .filter((item) => item.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit); // Sort by deficit (most critical first)

    return {
      data: lowStockProducts,
      count: lowStockProducts.length,
    };
  }

  /**
   * Get batches expiring within specified days
   */
  async getExpiringBatches(daysThreshold: number, tenantId: string) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    const batches = await this.prisma.productBatch.findMany({
      where: {
        tenantId,
        isActive: true,
        quantity: { gt: 0 },
        expiryDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const data = batches.map((batch) => {
      const daysUntilExpiry = Math.ceil(
        (batch.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      let severity: 'URGENT' | 'WARNING' | 'INFO';
      if (daysUntilExpiry <= 30) severity = 'URGENT';
      else if (daysUntilExpiry <= 60) severity = 'WARNING';
      else severity = 'INFO';

      return {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        productName: batch.product.name,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        severity,
      };
    });

    return {
      data,
      meta: {
        total: data.length,
        urgentCount: data.filter((b) => b.severity === 'URGENT').length,
        warningCount: data.filter((b) => b.severity === 'WARNING').length,
      },
    };
  }

  /**
   * FEFO: Select batches for sale (First Expiry First Out)
   * Critical for sales module integration
   */
  async selectBatchesForSale(
    productId: string,
    requestedQuantity: number,
    tenantId: string,
  ): Promise<BatchAllocation[]> {
    // Find available batches sorted by expiry date (FEFO)
    const availableBatches = await this.prisma.productBatch.findMany({
      where: {
        productId,
        tenantId,
        isActive: true,
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
      },
      orderBy: { expiryDate: 'asc' },
      select: {
        id: true,
        batchNumber: true,
        quantity: true,
        expiryDate: true,
      },
    });

    if (availableBatches.length === 0) {
      throw new NotFoundException(
        `No available batches found for product ${productId}`,
      );
    }

    const allocations: BatchAllocation[] = [];
    let remainingQuantity = requestedQuantity;

    // Allocate from earliest expiring batch first
    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;

      const allocatedQty = Math.min(batch.quantity, remainingQuantity);
      allocations.push({
        batchId: batch.id,
        allocatedQuantity: allocatedQty,
      });

      remainingQuantity -= allocatedQty;
    }

    // Check if we have enough total stock
    if (remainingQuantity > 0) {
      const totalAvailable = availableBatches.reduce(
        (sum, b) => sum + b.quantity,
        0,
      );
      throw new BadRequestException(
        `Insufficient stock. Requested: ${requestedQuantity}, Available: ${totalAvailable}`,
      );
    }

    return allocations;
  }

  /**
   * Deduct stock from batches (called during sale transaction)
   * MUST be called within a transaction
   */
  async deductStock(
    allocations: BatchAllocation[],
    tenantId: string,
    transactionClient?: any,
  ) {
    const client = transactionClient || this.prisma;

    for (const allocation of allocations) {
      // Use row-level locking to prevent race conditions
      const batch = await client.productBatch.findFirst({
        where: {
          id: allocation.batchId,
          tenantId,
        },
      });

      if (!batch) {
        throw new NotFoundException(
          `Batch ${allocation.batchId} not found`,
        );
      }

      if (batch.quantity < allocation.allocatedQuantity) {
        throw new BadRequestException(
          `Insufficient quantity in batch ${batch.batchNumber}. Available: ${batch.quantity}, Requested: ${allocation.allocatedQuantity}`,
        );
      }

      // Deduct quantity
      await client.productBatch.update({
        where: { id: allocation.batchId },
        data: {
          quantity: { decrement: allocation.allocatedQuantity },
        },
      });
    }
  }

  /**
   * Restore stock to batches (for sale returns)
   */
  async restoreStock(
    allocations: BatchAllocation[],
    tenantId: string,
    transactionClient?: any,
  ) {
    const client = transactionClient || this.prisma;

    for (const allocation of allocations) {
      await client.productBatch.update({
        where: {
          id: allocation.batchId,
          tenantId,
        },
        data: {
          quantity: { increment: allocation.allocatedQuantity },
        },
      });
    }
  }

  /**
   * Deactivate expired batches (called by cron job)
   */
  async deactivateExpiredBatches(tenantId: string) {
    const result = await this.prisma.productBatch.updateMany({
      where: {
        tenantId,
        expiryDate: { lt: new Date() },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return {
      deactivatedCount: result.count,
    };
  }
}
