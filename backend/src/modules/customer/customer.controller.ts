import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentTenant } from '@/common/decorators/current-tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Customer code already exists' })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List and search customers' })
  @ApiResponse({ status: 200, description: 'Paginated list of customers' })
  findAll(
    @Query() searchDto: SearchCustomerDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findAll(tenantId, searchDto);
  }

  @Get('generate-code')
  @ApiOperation({ summary: 'Generate next customer code' })
  @ApiResponse({ status: 200, description: 'Generated customer code' })
  generateCode(
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.generateCustomerCode(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findOne(id, tenantId);
  }

  @Get(':id/purchase-history')
  @ApiOperation({ summary: 'Get customer purchase history' })
  @ApiResponse({ status: 200, description: 'Purchase history retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  getPurchaseHistory(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getPurchaseHistory(id, tenantId);
  }

  @Get(':id/prescriptions')
  @ApiOperation({ summary: 'Get customer prescription history' })
  @ApiResponse({ status: 200, description: 'Prescription history retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  getPrescriptionHistory(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getPrescriptionHistory(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Update a customer' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 409, description: 'Customer code already exists' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a customer' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete customer with dependencies (sales, prescriptions)',
  })
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    await this.service.remove(id, tenantId);
    return { message: 'Customer deleted successfully' };
  }
}
