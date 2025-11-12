/**
 * Example: Product Controller with Audit Logging
 *
 * This file demonstrates how to apply audit logging to a controller.
 * Copy this pattern to your actual ProductController.
 */

import { Controller, Post, Patch, Delete, Body, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Auditable, AuditLogInterceptor } from '../interceptors/audit-log.interceptor';

// Apply @Auditable decorator to enable automatic audit logging
@Auditable('Product') // <- Specify entity type here
@UseInterceptors(AuditLogInterceptor) // <- Apply the interceptor
@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  // CREATE operation - automatically audited
  @Post()
  async create(@Body() createProductDto: any) {
    // Business logic here
    // Audit log will capture:
    // - action: CREATE
    // - newValues: product data
    // - oldValues: null
    return { id: 'product-1', ...createProductDto };
  }

  // UPDATE operation - automatically audited
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    // Business logic here
    // Audit log will capture:
    // - action: UPDATE
    // - oldValues: previous product state (if available)
    // - newValues: updated product data
    return { id, ...updateProductDto };
  }

  // DELETE operation - automatically audited
  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Business logic here
    // Audit log will capture:
    // - action: DELETE
    // - oldValues: product data before deletion (if available)
    // - newValues: null
    return { deleted: true };
  }
}

/**
 * Apply this pattern to other controllers:
 *
 * @Auditable('Sale')
 * class SaleController { ... }
 *
 * @Auditable('Prescription')
 * class PrescriptionController { ... }
 *
 * @Auditable('StockAdjustment')
 * class StockAdjustmentController { ... }
 *
 * @Auditable('User')
 * class UserController { ... }
 *
 * @Auditable('Tenant')
 * class TenantController { ... }
 */
