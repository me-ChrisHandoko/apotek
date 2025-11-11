import {
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Change password DTO
 */
export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password (required for non-admin users)',
    example: 'OldPassword@123',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  oldPassword?: string;

  @ApiProperty({
    description:
      'New password (min 8 chars, uppercase, lowercase, number, special char)',
    example: 'NewPassword@123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match newPassword)',
    example: 'NewPassword@123',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
