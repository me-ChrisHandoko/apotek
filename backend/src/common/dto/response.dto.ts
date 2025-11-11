import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard API response wrapper
 */
export class ResponseDto<T> {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({ description: 'Response timestamp', example: '2025-01-11T10:30:00Z' })
  timestamp: string;

  constructor(data: T, success: boolean = true) {
    this.success = success;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Standard error response
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode: number;

  @ApiProperty({ description: 'Error message', example: 'Validation failed' })
  message: string;

  @ApiProperty({
    description: 'Detailed error information',
    example: [{ field: 'email', message: 'Invalid email format' }],
  })
  errors?: any[];

  @ApiProperty({ description: 'Error timestamp', example: '2025-01-11T10:30:00Z' })
  timestamp: string;

  @ApiProperty({ description: 'Request path', example: '/api/v1/auth/login' })
  path: string;
}
