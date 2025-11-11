import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User decorator
 * Extracts authenticated user from request
 * Requires JwtAuthGuard to be applied
 *
 * @param data - Optional property name to extract from user object
 *
 * @example
 * // Get entire user object
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 *
 * @example
 * // Get specific property
 * @Get('my-id')
 * @UseGuards(JwtAuthGuard)
 * async getMyId(@CurrentUser('id') userId: number) {
 *   return userId;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
