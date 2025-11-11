import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply } from 'fastify';

/**
 * Global Prisma exception filter
 * Maps Prisma errors to appropriate HTTP status codes
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error occurred';

    // Map Prisma error codes to HTTP status codes
    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[]) || [];
        message = `Record with this ${target.join(', ')} already exists`;
        break;

      case 'P2025':
        // Record not found
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;

      case 'P2003':
        // Foreign key constraint violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference to related record';
        break;

      case 'P2014':
        // Required relation violation
        status = HttpStatus.BAD_REQUEST;
        message = 'The change you are trying to make would violate a required relation';
        break;

      case 'P2000':
        // Value too long for column
        status = HttpStatus.BAD_REQUEST;
        message = 'The provided value is too long for the field';
        break;

      case 'P2011':
        // Null constraint violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Required field cannot be null';
        break;

      default:
        // Log unhandled Prisma errors
        this.logger.error(
          `Unhandled Prisma error code: ${exception.code}`,
          exception.message,
        );
    }

    const errorResponse = {
      statusCode: status,
      message,
      error: process.env.NODE_ENV === 'development' ? exception.code : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `Prisma Error ${exception.code} at ${request.url}`,
      JSON.stringify(errorResponse),
    );

    response.status(status).send(errorResponse);
  }
}
