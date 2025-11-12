import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReturnSaleDto } from './dto/return-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new sale' })
  @ApiResponse({ status: 201, description: 'Sale created successfully' })
  @ApiResponse({ status: 422, description: 'Validation failed or insufficient stock' })
  async createSale(
    @Body() dto: CreateSaleDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.salesService.createSale(dto, userId, tenantId);
  }

  @Post('return')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Return a sale (full or partial)' })
  @ApiResponse({ status: 201, description: 'Sale returned successfully (credit note created)' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async returnSale(
    @Body() dto: ReturnSaleDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.salesService.returnSale(dto, userId, tenantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a sale' })
  @ApiResponse({ status: 200, description: 'Sale cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  async cancelSale(
    @Param('id') saleId: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.salesService.cancelSale(saleId, userId, tenantId, reason);
  }
}
