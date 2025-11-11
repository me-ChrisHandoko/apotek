import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current Tenant decorator
 * Extracts tenant context from request
 * Requires TenantContextMiddleware to be applied
 *
 * @param data - Optional property name to extract from tenant object
 *
 * @example
 * // Get entire tenant object
 * @Get('products')
 * @UseGuards(JwtAuthGuard)
 * async getProducts(@CurrentTenant() tenant: Tenant) {
 *   return this.productService.findAll(tenant.id);
 * }
 *
 * @example
 * // Get specific property
 * @Post('products')
 * @UseGuards(JwtAuthGuard)
 * async createProduct(
 *   @CurrentTenant('id') tenantId: number,
 *   @Body() dto: CreateProductDto,
 * ) {
 *   return this.productService.create(tenantId, dto);
 * }
 */
export const CurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    return data ? tenant?.[data] : tenant;
  },
);
