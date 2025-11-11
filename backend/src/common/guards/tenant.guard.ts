import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Tenant Guard
 * Ensures tenant context exists in request
 * Should be used after TenantContextMiddleware
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Check if tenant context exists
    if (!request.tenant) {
      throw new ForbiddenException(
        'Tenant context is required for this operation',
      );
    }

    // Check if tenant is active
    if (!request.tenant.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }

    return true;
  }
}
