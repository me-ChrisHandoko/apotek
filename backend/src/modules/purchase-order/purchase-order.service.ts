import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-po.dto';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uuid: UuidService,
  ) {}

  /**
   * Create a new purchase order
   */
  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const poId = this.uuid.generateV7();
      const poNumber = await this.generatePONumber(tenantId);

      // Calculate total cost
      const totalCost = dto.items.reduce(
        (sum, item) => sum + item.costPrice * item.quantity,
        0,
      );

      // Create PO
      const po = await tx.purchaseOrder.create({
        data: {
          id: poId,
          orderNumber: poNumber,
          tenantId,
          supplierId: dto.supplierId,
          userId,
          orderDate: new Date(),
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
          status: PurchaseOrderStatus.PENDING,
          totalCost,
          notes: dto.notes,
        },
      });

      // Create PO items
      for (const item of dto.items) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: po.id,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
            receivedQuantity: 0,
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          action: 'CREATE',
          userId,
          tenantId,
          ipAddress: 'system',
          newValues: po as any,
        },
      });

      this.logger.log(`PO created: ${po.id} with ${dto.items.length} items`);

      return po;
    });
  }

  /**
   * Receive purchase order and create product batches
   * This is the critical operation that creates inventory
   */
  async receivePurchaseOrder(
    dto: ReceivePurchaseOrderDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch PO
        const po = await tx.purchaseOrder.findUnique({
          where: { id: dto.purchaseOrderId },
          include: {
            purchaseOrderItems: true,
          },
        });

        if (!po) {
          throw new NotFoundException(
            `Purchase Order ${dto.purchaseOrderId} not found`,
          );
        }

        if (po.tenantId !== tenantId) {
          throw new NotFoundException(
            `Purchase Order ${dto.purchaseOrderId} not found`,
          );
        }

        if (po.status === PurchaseOrderStatus.RECEIVED) {
          throw new Error('Purchase Order already received');
        }

        if (po.status === PurchaseOrderStatus.CANCELLED) {
          throw new Error('Cannot receive cancelled Purchase Order');
        }

        // 2. Process each received item
        const createdBatches: any[] = [];

        for (const receivedItem of dto.items) {
          // Find corresponding PO item
          const poItem = po.purchaseOrderItems.find(
            (item) => item.productId === receivedItem.productId,
          );

          if (!poItem) {
            throw new Error(
              `Product ${receivedItem.productId} not in Purchase Order`,
            );
          }

          // Create ProductBatch with UUID v7
          const batchId = this.uuid.generateV7();

          const batch = await tx.productBatch.create({
            data: {
              id: batchId,
              tenantId,
              productId: receivedItem.productId,
              batchNumber: receivedItem.batchNumber,
              manufacturingDate: new Date(receivedItem.manufacturingDate),
              expiryDate: new Date(receivedItem.expiryDate),
              costPrice: receivedItem.costPrice,
              sellingPrice: receivedItem.sellingPrice,
              initialQuantity: receivedItem.receivedQuantity,
              currentQuantity: receivedItem.receivedQuantity,
              isActive: true,
              notes: receivedItem.notes,
            },
          });

          createdBatches.push(batch);

          // Update PO item received quantity
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQuantity: {
                increment: receivedItem.receivedQuantity,
              },
            },
          });
        }

        // 3. Check if PO is fully received
        const updatedPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: po.id },
        });

        const fullyReceived = updatedPOItems.every(
          (item) => item.receivedQuantity >= item.quantity,
        );

        // 4. Update PO status if fully received
        const updatedPO = await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: fullyReceived
              ? PurchaseOrderStatus.RECEIVED
              : PurchaseOrderStatus.PENDING,
            receivedDate: fullyReceived ? new Date() : null,
          },
        });

        // 5. Audit log
        await tx.auditLog.create({
          data: {
            entityType: 'PURCHASE_ORDER_RECEIVE',
            entityId: po.id,
            action: 'UPDATE',
            userId,
            tenantId,
            ipAddress: 'system',
            oldValues: { status: po.status } as any,
            newValues: {
              status: updatedPO.status,
              batchesCreated: createdBatches.length,
            } as any,
          },
        });

        this.logger.log(
          `PO ${po.id} received. Created ${createdBatches.length} batches. Status: ${updatedPO.status}`,
        );

        return {
          purchaseOrder: updatedPO,
          batchesCreated: createdBatches,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  /**
   * Cancel a purchase order
   */
  async cancelPurchaseOrder(
    poId: string,
    userId: string,
    tenantId: string,
    reason: string,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
      });

      if (!po) {
        throw new NotFoundException(`Purchase Order ${poId} not found`);
      }

      if (po.tenantId !== tenantId) {
        throw new NotFoundException(`Purchase Order ${poId} not found`);
      }

      if (po.status === PurchaseOrderStatus.RECEIVED) {
        throw new Error('Cannot cancel received Purchase Order');
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          notes: `${po.notes || ''}\nCancelled: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          action: 'UPDATE',
          userId,
          tenantId,
          ipAddress: 'system',
          oldValues: { status: po.status } as any,
          newValues: { status: PurchaseOrderStatus.CANCELLED, reason } as any,
        },
      });

      return updatedPO;
    });
  }

  /**
   * Generate PO number (similar to invoice number format)
   */
  private async generatePONumber(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { code: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const uuid = this.uuid.generateV7();
    const shortUuid = uuid.substring(24, 32).toUpperCase();

    return `PO-${tenant.code}-${dateStr}-${shortUuid}`;
  }
}
