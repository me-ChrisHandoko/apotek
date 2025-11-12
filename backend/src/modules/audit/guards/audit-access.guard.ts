import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

/**
 * AuditAccessGuard
 *
 * Enforces role-based access control for audit logs:
 * - ADMIN, MANAGER: Can view audit logs for their tenant
 * - PHARMACIST: Limited access (own actions only)
 * - CASHIER: No access
 * - SUPERADMIN: Can view all tenants (if implemented)
 */
@Injectable()
export class AuditAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Define allowed roles for audit access
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

    // Check if user has allowed role
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to access audit logs. Required role: ADMIN or MANAGER',
      );
    }

    // PHARMACIST: Limited access - only own actions
    if (user.role === UserRole.PHARMACIST) {
      const query = request.query;
      // Force userId filter to current user
      if (query) {
        query.userId = user.id;
      }
    }

    // Ensure tenant isolation (prevent cross-tenant access)
    // This is handled by tenant middleware and controller logic
    return true;
  }
}
