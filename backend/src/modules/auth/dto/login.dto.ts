import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Login request DTO
 */
export class LoginDto {
  @ApiProperty({
    description: 'Username or email',
    example: 'admin',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'Admin@123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'Tenant code (optional for subdomain-less access)',
    example: 'PHARM000001',
  })
  @IsString()
  @IsOptional()
  tenantCode?: string;
}

/**
 * Login response DTO
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    tenantId: string;
    isActive: boolean;
  };

  @ApiProperty({
    description: 'Tenant information',
  })
  tenant: {
    id: string;
    code: string;
    name: string;
  };
}
