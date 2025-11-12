import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from './audit-query.dto';

export class CreateAuditDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'User ID who performed the action' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Entity type (e.g., Product, Sale)' })
  @IsString()
  entityType: string;

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  entityId: string;

  @ApiProperty({ enum: AuditAction, description: 'Action type' })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiPropertyOptional({ description: 'Old values (before change)', type: 'object' })
  @IsOptional()
  @IsObject()
  oldValues?: Record<string, any>;

  @ApiPropertyOptional({ description: 'New values (after change)', type: 'object' })
  @IsOptional()
  @IsObject()
  newValues?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}
