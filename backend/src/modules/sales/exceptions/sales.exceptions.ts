import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for sales-related errors
 */
export class SalesException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, statusCode);
  }
}

/**
 * Thrown when there is insufficient stock to complete a sale
 */
export class InsufficientStockException extends HttpException {
  constructor(
    productId: string,
    requestedQuantity: number,
    availableQuantity: number,
  ) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock for product ${productId}. Requested: ${requestedQuantity}, Available: ${availableQuantity}`,
        availableQuantity,
        requestedQuantity,
        productId,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when a product requires a prescription but none is provided
 */
export class PrescriptionRequiredException extends HttpException {
  constructor(productName: string, productId: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'PRESCRIPTION_REQUIRED',
        message: `Product "${productName}" requires a valid prescription`,
        productId,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when prescription is not found
 */
export class PrescriptionNotFoundException extends HttpException {
  constructor(prescriptionId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'PRESCRIPTION_NOT_FOUND',
        message: `Prescription with ID ${prescriptionId} not found`,
        prescriptionId,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Thrown when prescription status is not ACTIVE
 */
export class PrescriptionInactiveException extends HttpException {
  constructor(prescriptionId: string, currentStatus: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'PRESCRIPTION_INACTIVE',
        message: `Prescription status is ${currentStatus}, must be ACTIVE`,
        prescriptionId,
        currentStatus,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when prescription has expired
 */
export class PrescriptionExpiredException extends HttpException {
  constructor(prescriptionId: string, validUntil: Date) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'PRESCRIPTION_EXPIRED',
        message: `Prescription expired on ${validUntil.toISOString()}`,
        prescriptionId,
        validUntil,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when product is not in prescription
 */
export class ProductNotInPrescriptionException extends HttpException {
  constructor(productId: string, prescriptionId: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'PRODUCT_NOT_IN_PRESCRIPTION',
        message: `Product ${productId} not found in prescription ${prescriptionId}`,
        productId,
        prescriptionId,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when attempting to dispense more than prescribed quantity
 */
export class ExceedsPrescribedQuantityException extends HttpException {
  constructor(
    productId: string,
    requestedQuantity: number,
    prescribedQuantity: number,
  ) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'EXCEEDS_PRESCRIBED_QUANTITY',
        message: `Cannot dispense ${requestedQuantity} units. Prescribed quantity: ${prescribedQuantity}`,
        productId,
        requestedQuantity,
        prescribedQuantity,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when no refills remaining for prescription
 */
export class NoRefillsRemainingException extends HttpException {
  constructor(
    prescriptionId: string,
    refillsUsed: number,
    refillsAllowed: number,
  ) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'NO_REFILLS_REMAINING',
        message: `No refills remaining. Used: ${refillsUsed}/${refillsAllowed}`,
        prescriptionId,
        refillsUsed,
        refillsAllowed,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when a batch has expired
 */
export class ExpiredBatchException extends HttpException {
  constructor(batchNumber: string, expiryDate: Date) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'EXPIRED_BATCH',
        message: `Batch "${batchNumber}" expired on ${expiryDate.toISOString()}`,
        batchNumber,
        expiryDate,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when optimistic locking conflict is detected
 */
export class OptimisticLockException extends HttpException {
  constructor(batchId: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'OPTIMISTIC_LOCK_CONFLICT',
        message: `Concurrent modification detected on batch ${batchId}. Please retry.`,
        batchId,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Thrown when attempting to return a sale that cannot be returned
 */
export class SaleNotReturnableException extends HttpException {
  constructor(saleId: string, reason: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'SALE_NOT_RETURNABLE',
        message: `Sale ${saleId} cannot be returned: ${reason}`,
        saleId,
        reason,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when sale is not found
 */
export class SaleNotFoundException extends HttpException {
  constructor(saleId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'SALE_NOT_FOUND',
        message: `Sale with ID ${saleId} not found`,
        saleId,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Thrown when invoice number generation fails
 */
export class InvoiceGenerationException extends HttpException {
  constructor(reason: string) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'INVOICE_GENERATION_FAILED',
        message: `Failed to generate invoice number: ${reason}`,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
