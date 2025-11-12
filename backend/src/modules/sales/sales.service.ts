import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { InvoiceGeneratorService } from './utils/invoice-generator.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReturnSaleDto } from './dto/return-sale.dto';
import {
  Prisma,
  SaleStatus,
  PrescriptionStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import {
  InsufficientStockException,
  PrescriptionRequiredException,
  PrescriptionNotFoundException,
  PrescriptionInactiveException,
  PrescriptionExpiredException,
  ProductNotInPrescriptionException,
  ExceedsPrescribedQuantityException,
  NoRefillsRemainingException,
  OptimisticLockException,
  SaleNotFoundException,
  SaleNotReturnableException,
} from './exceptions/sales.exceptions';

/**
 * Interface for batch allocation result
 */
interface BatchAllocation {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  expectedQuantity: number; // For optimistic locking
  unitPrice: any; // Decimal type from Prisma
  expiryDate: Date;
}

/**
 * Interface for prescription validation result
 */
interface PrescriptionValidationResult {
  prescription: any;
  validated: true;
  warnings: string[];
}

/**
 * Interface for refill tracking (interim solution using JSON field)
 */
interface RefillInfo {
  refillsAllowed: number;
  refillsUsed: number;
  dispensingHistory?: Array<{
    date: string;
    saleId: string;
    quantity: number;
  }>;
}

/**
 * Sales Service
 *
 * Handles all sales/POS operations including:
 * - Sale creation with FEFO batch allocation
 * - Prescription validation and controlled substance compliance
 * - Multi-payment processing
 * - Returns and cancellations
 * - Transaction management with optimistic locking
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uuid: UuidService,
    private readonly invoiceGenerator: InvoiceGeneratorService,
  ) {}

  /**
   * Create a new sale with transaction management
   *
   * Process:
   * 1. Validate prescription if required
   * 2. Allocate batches using FEFO logic
   * 3. Create sale and sale items
   * 4. Update batch quantities with optimistic locking
   * 5. Update prescription status
   * 6. Create payment records
   * 7. Create audit log
   *
   * @param dto - Sale creation data
   * @param userId - Current user (cashier/pharmacist)
   * @param tenantId - Current tenant ID
   * @returns Created sale with all related data
   */
  async createSale(
    dto: CreateSaleDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Generate UUID v7 for time-ordered ID
          const saleId = this.uuid.generateV7();

          // 2. Generate invoice number
          const invoiceNumber = await this.invoiceGenerator.generate(tenantId);

          // 3. Validate prescription if provided
          if (dto.prescriptionId) {
            await this.validatePrescription(
              dto.prescriptionId,
              dto.items,
              tenantId,
              tx,
            );
          }

          // 4. Allocate batches with FEFO logic
          const batchAllocations = await this.allocateBatchesWithFEFO(
            dto.items,
            tenantId,
            tx,
          );

          // 5. Validate products don't require prescription if not provided
          if (!dto.prescriptionId) {
            await this.validateNoPrescriptionRequired(
              batchAllocations,
              tenantId,
              tx,
            );
          }

          // 6. Calculate totals
          const { subtotal, totalDiscount, totalTax, grandTotal } =
            this.calculateTotals(batchAllocations, dto);

          // 7. Validate payment amount
          const totalPaid = dto.payments.reduce(
            (sum, payment) => sum + payment.amount,
            0,
          );

          if (totalPaid < grandTotal) {
            throw new Error(
              `Insufficient payment. Required: ${grandTotal}, Paid: ${totalPaid}`,
            );
          }

          const changeDue = totalPaid - grandTotal;

          // 8. Create Sale record
          const sale = await tx.sale.create({
            data: {
              id: saleId,
              invoiceNumber,
              tenantId,
              soldBy: userId,
              customerId: dto.customerId,
              prescriptionId: dto.prescriptionId,
              subtotal,
              discount: totalDiscount,
              tax: totalTax,
              total: grandTotal,
              paymentMethod: dto.payments[0]?.method || PaymentMethod.CASH,
              paymentStatus: PaymentStatus.PAID,
              status: SaleStatus.COMPLETED,
              saleDate: new Date(),
              notes: dto.notes,
            },
          });

          // 9. Create SaleItems (multiple per product if batch-spanning)
          const saleItems: any[] = [];
          for (const allocation of batchAllocations) {
            const itemDiscount =
              dto.items.find((i) => i.productId === allocation.productId)
                ?.discountPercentage || 0;

            const itemSubtotal = allocation.unitPrice * allocation.quantity;
            const itemDiscountAmount = itemSubtotal * (itemDiscount / 100);
            const itemAfterDiscount = itemSubtotal - itemDiscountAmount;
            const itemTax = itemAfterDiscount * ((dto.taxPercentage || 0) / 100);
            const itemTotal = itemAfterDiscount + itemTax;

            const saleItem = await tx.saleItem.create({
              data: {
                saleId: sale.id,
                productId: allocation.productId,
                productBatchId: allocation.batchId,
                quantity: allocation.quantity,
                unitPrice: allocation.unitPrice,
                discount: itemDiscountAmount,
                total: itemTotal,
                expiryDate: allocation.expiryDate,
              },
            });

            saleItems.push(saleItem);
          }

          // 10. Update batch quantities with optimistic locking
          for (const allocation of batchAllocations) {
            const updateResult = await tx.productBatch.updateMany({
              where: {
                id: allocation.batchId,
                currentQuantity: allocation.expectedQuantity, // Optimistic lock
              },
              data: {
                currentQuantity: {
                  decrement: allocation.quantity,
                },
              },
            });

            if (updateResult.count === 0) {
              throw new OptimisticLockException(allocation.batchId);
            }
          }

          // 11. Update prescription status if linked
          if (dto.prescriptionId) {
            await tx.prescription.update({
              where: { id: dto.prescriptionId },
              data: { status: PrescriptionStatus.DISPENSED },
            });
          }

          // 12. Payment info stored in Sale.paymentMethod field
          // Multi-payment support can be added later if needed

          // 13. Create audit log
          await tx.auditLog.create({
            data: {
              entityType: 'SALE',
              entityId: sale.id,
              action: 'CREATE',
              userId,
              tenantId,
              ipAddress: 'system', // TODO: Extract from request
              newValues: sale as any,
            },
          });

          const duration = Date.now() - startTime;
          this.logger.log(`Sale created: ${sale.id} in ${duration}ms`);

          return {
            ...sale,
            saleItems,
            batchAllocations,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Sale creation failed after ${duration}ms: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Allocate batches using FEFO (First Expiry First Out) logic
   *
   * Algorithm:
   * 1. Query batches ordered by expiry date (ASC) then creation date (ASC)
   * 2. Allocate quantity across batches, creating multiple SaleItems if needed
   * 3. Validate sufficient stock availability
   *
   * @param items - Sale items to allocate
   * @param tenantId - Current tenant
   * @param tx - Prisma transaction client
   * @returns Array of batch allocations
   * @throws InsufficientStockException if not enough stock
   */
  private async allocateBatchesWithFEFO(
    items: any[],
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<BatchAllocation[]> {
    const allocations: BatchAllocation[] = [];

    for (const item of items) {
      let remainingQty = item.quantity;

      // Query batches with FEFO ordering
      const batches = await tx.productBatch.findMany({
        where: {
          productId: item.productId,
          tenantId: tenantId,
          currentQuantity: { gt: 0 },
          expiryDate: { gt: new Date() },
          isActive: true,
        },
        orderBy: [
          { expiryDate: 'asc' }, // First expiry first
          { createdAt: 'asc' }, // Oldest batch first (tie-breaker)
        ],
        select: {
          id: true,
          batchNumber: true,
          currentQuantity: true,
          expiryDate: true,
          sellingPrice: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      if (batches.length === 0) {
        throw new InsufficientStockException(item.productId, item.quantity, 0);
      }

      // Allocate across batches
      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const allocateQty = Math.min(remainingQty, batch.currentQuantity);

        allocations.push({
          productId: item.productId,
          productName: batch.product.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: allocateQty,
          expectedQuantity: batch.currentQuantity, // For optimistic locking
          unitPrice: batch.sellingPrice,
          expiryDate: batch.expiryDate,
        });

        remainingQty -= allocateQty;
      }

      // Validate sufficient stock
      if (remainingQty > 0) {
        const availableQty = item.quantity - remainingQty;
        throw new InsufficientStockException(
          item.productId,
          item.quantity,
          availableQty,
        );
      }
    }

    return allocations;
  }

  /**
   * Validate prescription for controlled substances
   *
   * Multi-stage validation:
   * 1. Existence & ownership
   * 2. Status validation (must be ACTIVE)
   * 3. Date validation (not expired)
   * 4. Product matching
   * 5. Quantity validation
   * 6. DEA Schedule compliance
   *
   * @param prescriptionId - Prescription to validate
   * @param items - Sale items
   * @param tenantId - Current tenant
   * @param tx - Prisma transaction client
   * @throws Various prescription exceptions if validation fails
   */
  private async validatePrescription(
    prescriptionId: string,
    items: any[],
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<PrescriptionValidationResult> {
    // Stage 1: Fetch prescription with related data
    const prescription = await tx.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        prescriptionItems: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!prescription) {
      throw new PrescriptionNotFoundException(prescriptionId);
    }

    if (prescription.tenantId !== tenantId) {
      throw new PrescriptionNotFoundException(prescriptionId);
    }

    // Stage 2: Status validation
    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new PrescriptionInactiveException(
        prescriptionId,
        prescription.status,
      );
    }

    // Stage 3: Date validation
    if (prescription.validUntil && prescription.validUntil < new Date()) {
      throw new PrescriptionExpiredException(
        prescriptionId,
        prescription.validUntil,
      );
    }

    // Stage 4-6: Product matching and quantity validation
    for (const item of items) {
      const prescriptionItem = prescription.prescriptionItems.find(
        (pi) => pi.productId === item.productId,
      );

      if (!prescriptionItem) {
        throw new ProductNotInPrescriptionException(
          item.productId,
          prescriptionId,
        );
      }

      const product = prescriptionItem.product;

      // DEA Schedule validation
      if (product.deaSchedule === 'SCHEDULE_II') {
        // Schedule II: Strict quantity matching, no over-dispensing
        if (item.quantity > prescriptionItem.quantity) {
          throw new ExceedsPrescribedQuantityException(
            item.productId,
            item.quantity,
            prescriptionItem.quantity,
          );
        }
      } else if (
        product.deaSchedule === 'SCHEDULE_III' ||
        product.deaSchedule === 'SCHEDULE_IV'
      ) {
        // Check refills (interim solution using JSON field)
        const refillInfo = this.getRefillInfo(prescription);

        if (refillInfo.refillsUsed >= refillInfo.refillsAllowed) {
          throw new NoRefillsRemainingException(
            prescriptionId,
            refillInfo.refillsUsed,
            refillInfo.refillsAllowed,
          );
        }
      }
    }

    return {
      prescription,
      validated: true,
      warnings: [],
    };
  }

  /**
   * Validate products don't require prescription if none provided
   */
  private async validateNoPrescriptionRequired(
    allocations: BatchAllocation[],
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const productIds = [...new Set(allocations.map((a) => a.productId))];

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
      select: {
        id: true,
        name: true,
        requiresPrescription: true,
      },
    });

    for (const product of products) {
      if (product.requiresPrescription) {
        throw new PrescriptionRequiredException(product.name, product.id);
      }
    }
  }

  /**
   * Get refill info from prescription (interim solution using JSON field)
   */
  private getRefillInfo(prescription: any): RefillInfo {
    const notes = prescription.notes as any;
    return {
      refillsAllowed: notes?.refillsAllowed ?? 0,
      refillsUsed: notes?.refillsUsed ?? 0,
      dispensingHistory: notes?.dispensingHistory ?? [],
    };
  }

  /**
   * Calculate sale totals
   */
  private calculateTotals(
    allocations: BatchAllocation[],
    dto: CreateSaleDto,
  ): {
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
  } {
    let subtotal = 0;
    let totalDiscount = 0;

    // Calculate item-level totals
    for (const allocation of allocations) {
      const item = dto.items.find((i) => i.productId === allocation.productId);
      const itemSubtotal = allocation.unitPrice * allocation.quantity;
      const itemDiscount =
        itemSubtotal * ((item?.discountPercentage || 0) / 100);

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
    }

    // Add sale-level discount
    const saleLevelDiscount = subtotal * ((dto.discountPercentage || 0) / 100);
    totalDiscount += saleLevelDiscount;

    // Calculate tax on discounted amount
    const afterDiscount = subtotal - totalDiscount;
    const totalTax = afterDiscount * ((dto.taxPercentage || 0) / 100);

    const grandTotal = afterDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    };
  }

  /**
   * Return a sale (full or partial using credit note pattern)
   *
   * @param dto - Return sale data
   * @param userId - Current user
   * @param tenantId - Current tenant
   * @returns Credit note sale record
   */
  async returnSale(
    dto: ReturnSaleDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch original sale
      const originalSale = await tx.sale.findUnique({
        where: { id: dto.saleId },
        include: {
          saleItems: {
            include: {
              product: true,
              productBatch: true,
            },
          },
        },
      });

      if (!originalSale) {
        throw new SaleNotFoundException(dto.saleId);
      }

      if (originalSale.tenantId !== tenantId) {
        throw new SaleNotFoundException(dto.saleId);
      }

      // 2. Validate sale can be returned
      if (originalSale.status !== SaleStatus.COMPLETED) {
        throw new SaleNotReturnableException(
          dto.saleId,
          `Sale status is ${originalSale.status}`,
        );
      }

      // 3. Determine items to return
      const itemsToReturn = dto.itemIds
        ? originalSale.saleItems.filter((item) =>
            dto.itemIds!.includes(item.id),
          )
        : originalSale.saleItems;

      if (itemsToReturn.length === 0) {
        throw new SaleNotReturnableException(dto.saleId, 'No items to return');
      }

      // 4. Calculate return amount
      const returnAmount = itemsToReturn.reduce(
        (sum, item) => sum + Number(item.total),
        0,
      );

      // 5. Create credit note (negative sale)
      const creditNoteId = this.uuid.generateV7();
      const creditNoteNumber = `CN-${originalSale.invoiceNumber}`;

      const creditNote = await tx.sale.create({
        data: {
          id: creditNoteId,
          invoiceNumber: creditNoteNumber,
          tenantId,
          soldBy: userId,
          customerId: originalSale.customerId,
          subtotal: -returnAmount,
          discount: 0,
          tax: 0,
          total: -returnAmount,
          paymentMethod: originalSale.paymentMethod,
          paymentStatus: PaymentStatus.PAID,
          status: SaleStatus.RETURNED,
          saleDate: new Date(),
          notes: `Credit note for sale ${originalSale.invoiceNumber}. Reason: ${dto.reason}`,
        },
      });

      // 6. Restore stock quantities
      for (const item of itemsToReturn) {
        await tx.productBatch.update({
          where: { id: item.productBatchId },
          data: {
            currentQuantity: {
              increment: item.quantity,
            },
          },
        });

        // Create negative sale item
        await tx.saleItem.create({
          data: {
            saleId: creditNote.id,
            productId: item.productId,
            productBatchId: item.productBatchId,
            quantity: -item.quantity,
            unitPrice: item.unitPrice,
            discount: 0,
            total: -item.total,
            expiryDate: item.expiryDate,
          },
        });
      }

      // 7. Update original sale status if full return
      if (itemsToReturn.length === originalSale.saleItems.length) {
        await tx.sale.update({
          where: { id: dto.saleId },
          data: { status: SaleStatus.RETURNED },
        });
      }

      // 8. Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SALE_RETURN',
          entityId: creditNote.id,
          action: 'CREATE',
          userId,
          tenantId,
          ipAddress: 'system',
          newValues: {
            creditNoteId: creditNote.id,
            originalSaleId: dto.saleId,
            reason: dto.reason,
            returnAmount,
          } as any,
        },
      });

      return creditNote;
    });
  }

  /**
   * Cancel a sale (before delivery)
   *
   * @param saleId - Sale ID to cancel
   * @param userId - Current user
   * @param tenantId - Current tenant
   * @param reason - Cancellation reason
   */
  async cancelSale(
    saleId: string,
    userId: string,
    tenantId: string,
    reason: string,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          saleItems: true,
        },
      });

      if (!sale) {
        throw new SaleNotFoundException(saleId);
      }

      if (sale.tenantId !== tenantId) {
        throw new SaleNotFoundException(saleId);
      }

      if (sale.status !== SaleStatus.COMPLETED) {
        throw new SaleNotReturnableException(
          saleId,
          `Cannot cancel sale with status ${sale.status}`,
        );
      }

      // Restore stock
      for (const item of sale.saleItems) {
        await tx.productBatch.update({
          where: { id: item.productBatchId },
          data: {
            currentQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.CANCELLED,
          notes: `${sale.notes || ''}\nCancelled: ${reason}`,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SALE_CANCEL',
          entityId: saleId,
          action: 'UPDATE',
          userId,
          tenantId,
          ipAddress: 'system',
          oldValues: { status: SaleStatus.COMPLETED } as any,
          newValues: { status: SaleStatus.CANCELLED, reason } as any,
        },
      });

      return updatedSale;
    });
  }
}
