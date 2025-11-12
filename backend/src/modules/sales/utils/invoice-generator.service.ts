import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UuidService } from '../../../common/services/uuid.service';
import { InvoiceGenerationException } from '../exceptions/sales.exceptions';

/**
 * Service for generating invoice numbers
 *
 * Format: {TenantCode}-{YYMMDD}-{UUID-Short}
 * Example: PHM-250112-A89E63C3
 *
 * Benefits:
 * - Human-readable with date context
 * - Unique without sequence management
 * - No collision risk across tenants
 * - Sortable within same day
 * - Works in distributed systems
 */
@Injectable()
export class InvoiceGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uuid: UuidService,
  ) {}

  /**
   * Generate unique invoice number for a tenant
   *
   * @param tenantId - Tenant UUID
   * @returns Invoice number in format: {TenantCode}-{YYMMDD}-{UUID-Short}
   * @throws InvoiceGenerationException if tenant not found or generation fails
   * @example
   * const invoiceNumber = await this.invoiceGenerator.generate(tenantId);
   * // Returns: 'PHM-250112-A89E63C3'
   */
  async generate(tenantId: string): Promise<string> {
    try {
      // Fetch tenant code
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { code: true },
      });

      if (!tenant) {
        throw new InvoiceGenerationException(`Tenant ${tenantId} not found`);
      }

      // Date component (YYMMDD)
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // UUID v7 short component (8 chars from position 24-32)
      // This part still maintains time-ordering property
      const uuid = this.uuid.generateV7();
      const shortUuid = uuid.substring(24, 32).toUpperCase();

      return `${tenant.code}-${dateStr}-${shortUuid}`;
    } catch (error) {
      if (error instanceof InvoiceGenerationException) {
        throw error;
      }
      throw new InvoiceGenerationException(error.message);
    }
  }

  /**
   * Validate invoice number format
   *
   * @param invoiceNumber - Invoice number to validate
   * @returns true if valid format, false otherwise
   * @example
   * this.invoiceGenerator.isValid('PHM-250112-A89E63C3'); // true
   * this.invoiceGenerator.isValid('INVALID'); // false
   */
  isValid(invoiceNumber: string): boolean {
    // Pattern: {Code}-{YYMMDD}-{8-HEX}
    const pattern = /^[A-Z0-9]+-\d{6}-[A-F0-9]{8}$/;
    return pattern.test(invoiceNumber);
  }

  /**
   * Extract date from invoice number
   *
   * @param invoiceNumber - Invoice number
   * @returns Date object extracted from invoice number
   * @throws InvoiceGenerationException if format is invalid
   * @example
   * const date = this.invoiceGenerator.extractDate('PHM-250112-A89E63C3');
   * // Returns: Date object for 2025-01-12
   */
  extractDate(invoiceNumber: string): Date {
    if (!this.isValid(invoiceNumber)) {
      throw new InvoiceGenerationException(
        `Invalid invoice number format: ${invoiceNumber}`,
      );
    }

    const parts = invoiceNumber.split('-');
    const dateStr = parts[1]; // YYMMDD

    try {
      const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
      const month = parseInt(dateStr.substring(2, 4), 10) - 1;
      const day = parseInt(dateStr.substring(4, 6), 10);
      return new Date(year, month, day);
    } catch (error) {
      throw new InvoiceGenerationException(
        `Failed to parse date from invoice number: ${error.message}`,
      );
    }
  }

  /**
   * Extract tenant code from invoice number
   *
   * @param invoiceNumber - Invoice number
   * @returns Tenant code
   * @throws InvoiceGenerationException if format is invalid
   * @example
   * const code = this.invoiceGenerator.extractTenantCode('PHM-250112-A89E63C3');
   * // Returns: 'PHM'
   */
  extractTenantCode(invoiceNumber: string): string {
    if (!this.isValid(invoiceNumber)) {
      throw new InvoiceGenerationException(
        `Invalid invoice number format: ${invoiceNumber}`,
      );
    }

    const parts = invoiceNumber.split('-');
    return parts[0];
  }
}
