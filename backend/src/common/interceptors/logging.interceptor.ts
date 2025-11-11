import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

/**
 * Global logging interceptor
 * Logs all HTTP requests and responses with context
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, tenant, ip } = request;
    const now = Date.now();

    // Log request
    this.logger.log(
      JSON.stringify({
        type: 'REQUEST',
        method,
        url,
        userId: user?.id,
        tenantId: tenant?.id,
        ip,
        body: this.sanitizeBody(body),
      }),
    );

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;

        // Log successful response
        this.logger.log(
          JSON.stringify({
            type: 'RESPONSE',
            method,
            url,
            statusCode: response.statusCode,
            duration: `${delay}ms`,
            userId: user?.id,
            tenantId: tenant?.id,
          }),
        );
      }),
      catchError((error) => {
        const delay = Date.now() - now;

        // Log error
        this.logger.error(
          JSON.stringify({
            type: 'ERROR',
            method,
            url,
            error: error.message,
            duration: `${delay}ms`,
            userId: user?.id,
            tenantId: tenant?.id,
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'oldPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'refreshToken',
      'accessToken',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
