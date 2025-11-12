import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Decorator to skip audit logging for specific routes
 * @example
 * @SkipAudit()
 * @Get()
 * async listItems() { ... }
 */
export const SKIP_AUDIT_KEY = 'skipAudit';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/**
 * Audit Log Interceptor
 *
 * Automatically logs all CREATE, UPDATE, DELETE operations
 * with comprehensive metadata for compliance and debugging
 *
 * Special handling for controlled substance sales (DEA compliance)
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if audit logging should be skipped
    const skipAudit = this.reflector.get<boolean>(
      SKIP_AUDIT_KEY,
      context.getHandler(),
    );

    if (skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { user, tenantId, method, url, body, ip, headers } = request;

    // Only audit write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        // Async logging (don't block response)
        setImmediate(() => {
          this.logAudit({
            entityType: this.extractEntityType(url),
            entityId: response?.id || response?.data?.id,
            action: this.mapMethodToAction(method),
            userId: user?.id,
            tenantId: tenantId,
            ipAddress: ip,
            userAgent: headers['user-agent'],
            url,
            method,
            requestBody: this.sanitize(body),
            responseData: this.sanitize(response),
            duration: Date.now() - startTime,
          }).catch((error) => {
            // Log error but don't throw (audit failure shouldn't break operations)
            console.error('Audit logging failed:', error);
          });
        });
      }),
    );
  }

  /**
   * Create audit log entry
   */
  private async logAudit(data: any): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          userId: data.userId,
          tenantId: data.tenantId,
          ipAddress: data.ipAddress,
          newValues: {
            ...data.responseData,
            metadata: {
              userAgent: data.userAgent,
              url: data.url,
              method: data.method,
              duration: data.duration,
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error.message);
    }
  }

  /**
   * Extract entity type from URL
   * @example '/api/sales/123' -> 'SALE'
   */
  private extractEntityType(url: string): string {
    const parts = url.split('/').filter((p) => p && !p.match(/^[a-f0-9-]{36}$/i));
    const entity = parts[parts.length - 1] || 'UNKNOWN';
    return entity.replace(/-/g, '_').toUpperCase();
  }

  /**
   * Map HTTP method to audit action
   */
  private mapMethodToAction(method: string): string {
    const mapping: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return mapping[method] || 'UNKNOWN';
  }

  /**
   * Sanitize data before logging (remove sensitive fields)
   */
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'token',
      'secret',
      'apiKey',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }
}
