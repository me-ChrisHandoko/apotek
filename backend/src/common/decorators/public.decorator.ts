import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public decorator
 * Marks a route as public (skips JWT authentication)
 *
 * @example
 * @Public()
 * @Post('login')
 * async login(@Body() dto: LoginDto) {
 *   return this.authService.login(dto);
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
