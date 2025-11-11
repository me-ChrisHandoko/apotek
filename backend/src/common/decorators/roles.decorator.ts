import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key for required roles
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator
 * Defines required roles for accessing a route
 * Must be used with RolesGuard
 *
 * @param roles - Array of UserRole enums (OR logic - user needs ANY of these roles)
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @Get('users')
 * async getUsers() {
 *   return this.userService.findAll();
 * }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
