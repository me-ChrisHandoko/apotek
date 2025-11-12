import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-po.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: 201, description: 'PO created successfully' })
  async createPO(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.poService.createPurchaseOrder(dto, userId, tenantId);
  }

  @Post('receive')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Receive purchase order and create product batches',
  })
  @ApiResponse({
    status: 201,
    description: 'PO received and batches created',
  })
  async receivePO(
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.poService.receivePurchaseOrder(dto, userId, tenantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @ApiResponse({ status: 200, description: 'PO cancelled successfully' })
  async cancelPO(
    @Param('id') poId: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.poService.cancelPurchaseOrder(
      poId,
      userId,
      tenantId,
      reason,
    );
  }
}
