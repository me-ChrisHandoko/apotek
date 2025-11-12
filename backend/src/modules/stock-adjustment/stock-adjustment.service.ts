import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { AdjustmentType } from '@prisma/client';

@Injectable()
export class StockAdjustmentService {
  constructor(
    private prisma: PrismaService,
    private uuid: UuidService,
  ) {}

  /**
   * Create stock adjustment with transaction
   * Updates batch quantity atomically
   */
  async createAdjustment(
    dto: CreateAdjustmentDto,
    userId: string,
    tenantId: string,
  ) {
    // Validate quantity change is not zero
    if (dto.quantityChange === 0) {
      throw new BadRequestException('Quantity change cannot be zero');
    }

    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Lock and get batch with current quantity
      const batch = await tx.productBatch.findFirst({
        where: {
          id: dto.productBatchId,
          tenantId,
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException(
          `Batch with ID ${dto.productBatchId} not found`,
        );
      }

      // Validate batch is active
      if (!batch.isActive) {
        throw new BadRequestException(
          'Cannot adjust quantity on inactive batch',
        );
      }

      // Calculate new quantity
      const quantityBefore = batch.currentQuantity;
      const quantityAfter = quantityBefore + dto.quantityChange;

      // Validate quantity will not go negative
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Insufficient quantity. Current: ${quantityBefore}, Change: ${dto.quantityChange}, Result would be: ${quantityAfter}`,
        );
      }

      // Generate adjustment number: ADJ-YYYYMMDD-XXX
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

      // Get count of adjustments today for this tenant
      const todayStart = new Date(today.setHours(0, 0, 0, 0));
      const todayEnd = new Date(today.setHours(23, 59, 59, 999));

      const todayCount = await tx.stockAdjustment.count({
        where: {
          tenantId,
          adjustmentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      const adjustmentNumber = `ADJ-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

      // Create stock adjustment record with UUID v7
      const adjustmentId = this.uuid.generateV7();

      const adjustment = await tx.stockAdjustment.create({
        data: {
          id: adjustmentId,
          productBatchId: dto.productBatchId,
          adjustmentType: dto.adjustmentType,
          quantityBefore,
          quantityAfter,
          reason: dto.reason,
          adjustedBy: userId,
          tenantId,
        },
        include: {
          productBatch: {
            select: {
              batchNumber: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              username: true,
              fullName: true,
            },
          },
        },
      });

      // Update batch quantity
      await tx.productBatch.update({
        where: { id: dto.productBatchId },
        data: {
          currentQuantity: quantityAfter,
          // Optionally deactivate if quantity becomes zero
          ...(quantityAfter === 0 && { isActive: false }),
        },
      });

      return adjustment;
    });
  }

  /**
   * Find all adjustments with filtering
   */
  async findAllAdjustments(
    filters: {
      productBatchId?: string;
      adjustmentType?: AdjustmentType;
      startDate?: string;
      endDate?: string;
      adjustedBy?: string;
      page?: number;
      limit?: number;
    },
    tenantId: string,
  ) {
    const {
      productBatchId,
      adjustmentType,
      startDate,
      endDate,
      adjustedBy,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { tenantId };

    if (productBatchId) {
      where.productBatchId = productBatchId;
    }

    if (adjustmentType) {
      where.adjustmentType = adjustmentType;
    }

    if (adjustedBy) {
      where.adjustedBy = adjustedBy;
    }

    if (startDate || endDate) {
      where.adjustmentDate = {};
      if (startDate) {
        where.adjustmentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.adjustmentDate.lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const [adjustments, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          productBatch: {
            select: {
              batchNumber: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { adjustmentDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return {
      data: adjustments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single adjustment by ID
   */
  async findAdjustmentById(id: string, tenantId: string) {
    const adjustment = await this.prisma.stockAdjustment.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
          },
        },
        productBatch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            product: {
              select: {
                code: true,
                name: true,
                genericName: true,
              },
            },
          },
        },
      },
    });

    if (!adjustment) {
      throw new NotFoundException(`Adjustment with ID ${id} not found`);
    }

    return adjustment;
  }

  /**
   * Get adjustment summary statistics
   */
  async getAdjustmentSummary(
    filters: {
      startDate?: string;
      endDate?: string;
      groupBy?: 'type' | 'product' | 'user';
    },
    tenantId: string,
  ) {
    const { startDate, endDate } = filters;

    const where: any = { tenantId };

    if (startDate || endDate) {
      where.adjustmentDate = {};
      if (startDate) {
        where.adjustmentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.adjustmentDate.lte = new Date(endDate);
      }
    }

    // Get all adjustments in period
    const adjustments = await this.prisma.stockAdjustment.findMany({
      where,
      include: {
        productBatch: {
          select: {
            costPrice: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Calculate statistics by type
    const byType: Record<
      string,
      { count: number; totalQuantity: number; lossValue: number }
    > = {};

    for (const adj of adjustments) {
      if (!byType[adj.adjustmentType]) {
        byType[adj.adjustmentType] = {
          count: 0,
          totalQuantity: 0,
          lossValue: 0,
        };
      }

      const quantityChange = adj.quantityAfter - adj.quantityBefore;
      byType[adj.adjustmentType].count++;
      byType[adj.adjustmentType].totalQuantity += Math.abs(quantityChange);

      // Calculate loss value for negative adjustments
      if (quantityChange < 0) {
        const lossQty = Math.abs(quantityChange);
        const lossValue = lossQty * Number(adj.productBatch.costPrice);
        byType[adj.adjustmentType].lossValue += lossValue;
      }
    }

    // Most frequently adjusted products
    const productAdjustments = new Map<string, number>();
    for (const adj of adjustments) {
      const productName = adj.productBatch.product.name;
      productAdjustments.set(
        productName,
        (productAdjustments.get(productName) || 0) + 1,
      );
    }

    const mostAdjustedProducts = Array.from(productAdjustments.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([productName, adjustmentCount]) => ({
        productName,
        adjustmentCount,
      }));

    // Calculate total loss value
    const totalLossValue = Object.values(byType).reduce(
      (sum, stat) => sum + stat.lossValue,
      0,
    );

    return {
      totalAdjustments: adjustments.length,
      byType,
      totalLossValue,
      mostAdjustedProducts,
    };
  }
}
