import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrescriptionItemService {
  constructor(private prisma: PrismaService) {}

  /**
   * NOTE: Current Prisma schema does not support partial dispensing
   * The schema only has 'quantity' field, not 'prescribedQuantity' and 'dispensedQuantity'
   * This service is a placeholder for Phase 4 when the schema will be updated
   *
   * Update dispensed quantity (called during sales transaction)
   * MUST be called within a transaction
   */
  async updateDispensedQuantity(
    itemId: string,
    quantityDispensed: number,
    tenantId: string,
    transactionClient?: any,
  ) {
    const client = transactionClient || this.prisma;

    return client.$transaction(async (tx) => {
      // Get item with prescription
      const item = await tx.prescriptionItem.findFirst({
        where: { id: itemId },
        include: {
          prescription: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!item) {
        throw new BadRequestException(`Prescription item ${itemId} not found`);
      }

      // Validate prescription belongs to tenant
      if (item.prescription.tenantId !== tenantId) {
        throw new BadRequestException('Prescription does not belong to this tenant');
      }

      // NOTE: Schema limitation - cannot track partial dispensing
      // For now, just validate that quantity requested doesn't exceed prescribed
      if (quantityDispensed > item.quantity) {
        throw new BadRequestException(
          `Cannot dispense ${quantityDispensed} units. Only ${item.quantity} units prescribed`,
        );
      }

      // For now, mark prescription as DISPENSED after any dispensing
      // This is a simplified implementation until schema supports partial tracking
      await tx.prescription.update({
        where: { id: item.prescriptionId },
        data: {
          status: PrescriptionStatus.DISPENSED,
        },
      });

      return item;
    });
  }

  /**
   * Get remaining quantity for an item
   * NOTE: Limited functionality due to schema constraints
   */
  async getRemainingQuantity(itemId: string, tenantId: string) {
    const item = await this.prisma.prescriptionItem.findFirst({
      where: {
        id: itemId,
        prescription: { tenantId },
      },
      select: {
        quantity: true,
      },
    });

    if (!item) {
      throw new BadRequestException(`Prescription item ${itemId} not found`);
    }

    // NOTE: Schema doesn't track dispensed quantity
    // Returning full quantity as available
    return {
      prescribedQuantity: item.quantity,
      dispensedQuantity: 0, // Not tracked in current schema
      remainingQuantity: item.quantity,
    };
  }
}
