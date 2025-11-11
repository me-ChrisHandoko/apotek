import { PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

/**
 * Update tenant DTO
 * Excludes 'code' field (immutable after creation)
 */
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, ['code'] as const),
) {
  @ApiPropertyOptional({
    description: 'Tenant active status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
