import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole, PrescriptionStatus } from '@prisma/client';

@ApiTags('Prescription Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Create new prescription',
    description:
      'Create prescription with validation for DEA compliance and product requirements',
  })
  @ApiResponse({ status: 201, description: 'Prescription created successfully' })
  @ApiResponse({ status: 404, description: 'Customer or product not found' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or DEA compliance issue',
  })
  createPrescription(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.prescriptionService.createPrescription(
      createPrescriptionDto,
      tenantId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List all prescriptions',
    description: 'Get paginated list of prescriptions with filtering',
  })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PrescriptionStatus })
  @ApiQuery({ name: 'doctorName', required: false, type: String })
  @ApiQuery({ name: 'isExpiring', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of prescriptions retrieved successfully',
  })
  findAllPrescriptions(
    @CurrentTenant() tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: PrescriptionStatus,
    @Query('doctorName') doctorName?: string,
    @Query('isExpiring') isExpiring?: boolean,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.prescriptionService.findAllPrescriptions(
      {
        customerId,
        status,
        doctorName,
        isExpiring,
        startDate,
        endDate,
        page,
        limit,
      },
      tenantId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get prescription details',
    description:
      'Retrieve detailed prescription information with remaining quantities',
  })
  @ApiParam({ name: 'id', description: 'Prescription UUID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  findPrescriptionById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.prescriptionService.findPrescriptionById(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Update prescription',
    description: 'Update prescription status, notes, or extend validity',
  })
  @ApiParam({ name: 'id', description: 'Prescription UUID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition or validation error',
  })
  updatePrescription(
    @Param('id') id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.prescriptionService.updatePrescription(
      id,
      updatePrescriptionDto,
      tenantId,
    );
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate prescription for dispensing',
    description:
      'Validate prescription status, expiry, and DEA compliance before dispensing',
  })
  @ApiParam({ name: 'id', description: 'Prescription UUID' })
  @ApiResponse({
    status: 200,
    description: 'Validation result with errors if any',
  })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  validatePrescription(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.prescriptionService.validatePrescription(id, tenantId);
  }

  @Post('cancel-expired')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch expire prescriptions',
    description: 'Manually trigger expiration of old prescriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Expired prescriptions count',
  })
  expireOldPrescriptions(@CurrentTenant() tenantId: string) {
    return this.prescriptionService.expireOldPrescriptions(tenantId);
  }
}
