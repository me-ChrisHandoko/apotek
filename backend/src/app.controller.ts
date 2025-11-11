import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

/**
 * App Controller
 * Provides health check and application status endpoints
 */
@ApiTags('Health')
@Controller()
export class AppController {
  /**
   * Health check endpoint
   * Public endpoint to verify application is running
   */
  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check if the application is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-01-10T12:00:00.000Z' },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Root endpoint
   * Public endpoint providing API information
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'API information',
    description: 'Get basic API information',
  })
  @ApiResponse({
    status: 200,
    description: 'API information retrieved',
  })
  getInfo() {
    return {
      name: 'Apotek Management System API',
      version: '1.0.0',
      description: 'Multi-tenant pharmacy management system',
      documentation: '/api/docs',
    };
  }
}
