import { PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Update user DTO
 * Excludes 'username' (immutable) and 'password' (separate endpoint)
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['username', 'password'] as const),
) {
  @ApiPropertyOptional({
    description: 'User active status (admin only)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
