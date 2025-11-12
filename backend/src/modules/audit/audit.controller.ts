import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { CurrentTenant } from '@/common/decorators/current-tenant.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AuditAccessGuard } from './guards/audit-access.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, AuditAccessGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Query audit logs with filters. Automatically scoped to current tenant for non-superadmin users.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: AuditQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    // Force tenant filter for non-superadmin users
    const queryWithTenant = {
      ...query,
      tenantId: tenantId || query.tenantId,
    };

    return this.auditService.findAll(queryWithTenant);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get audit statistics',
    description: 'Get audit log statistics for the last 30 days',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getStatistics(@CurrentTenant() tenantId: string) {
    return this.auditService.getStatistics(tenantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get audit log by ID',
    description: 'Retrieve a specific audit log entry',
  })
  @ApiParam({
    name: 'id',
    description: 'Audit log ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log found',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log not found',
  })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.auditService.findOne(id, tenantId);
  }

  @Get('entity/:entityType/:entityId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get audit trail for entity',
    description: 'Retrieve complete audit trail for a specific entity',
  })
  @ApiParam({
    name: 'entityType',
    description: 'Entity type (e.g., Product, Sale)',
  })
  @ApiParam({
    name: 'entityId',
    description: 'Entity ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit trail retrieved',
  })
  @HttpCode(HttpStatus.OK)
  async getEntityAuditTrail(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.auditService.getEntityAuditTrail(entityType, entityId, tenantId);
  }
}
