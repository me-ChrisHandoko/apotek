import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Global HTTP exception filter
 * Standardizes error responses across the application
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exception.message;

    const errors =
      typeof exceptionResponse === 'object' &&
      (exceptionResponse as any).errors
        ? (exceptionResponse as any).errors
        : undefined;

    const errorResponse = {
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log error with context
    this.logger.error(
      `HTTP ${status} Error at ${request.url}`,
      JSON.stringify({
        ...errorResponse,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        user: (request as any).user?.id,
        tenant: (request as any).tenant?.id,
      }),
    );

    // Mask sensitive data in production
    if (process.env.NODE_ENV === 'production') {
      // Don't expose stack traces in production
      delete (errorResponse as any).stack;
    }

    response.status(status).send(errorResponse);
  }
}
