import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { TenantService } from '../../modules/tenant/tenant.service';

/**
 * Tenant Context Middleware
 * Extracts tenant context from request and attaches to req.tenant
 * Priority order: JWT payload > Header > Subdomain > Query parameter
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private tenantService: TenantService,
    private jwtService: JwtService,
  ) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      const tenantIdentifier = await this.extractTenantIdentifier(req);

      if (!tenantIdentifier) {
        // Some endpoints might not require tenant context (e.g., auth endpoints)
        // So we don't throw error here, let the route handler decide
        this.logger.debug('No tenant identifier found in request');
        return next();
      }

      // Get tenant context (with caching)
      const tenant = await this.tenantService.getTenantContext(
        tenantIdentifier,
      );

      // Attach tenant to request
      (req as any).tenant = tenant;

      this.logger.debug(
        `Tenant context set: ${tenant.code} (ID: ${tenant.id})`,
      );

      next();
    } catch (error) {
      this.logger.error(`Error setting tenant context: ${error.message}`);
      throw new ForbiddenException('Invalid tenant context');
    }
  }

  /**
   * Extract tenant identifier from request
   * Priority: JWT > Header > Subdomain > Query
   */
  private async extractTenantIdentifier(
    req: any,
  ): Promise<string | null> {
    // 1. Try to get from JWT payload (most secure)
    const tenantFromJwt = await this.extractFromJwt(req);
    if (tenantFromJwt) {
      return tenantFromJwt;
    }

    // 2. Try to get from custom header
    const tenantFromHeader = this.extractFromHeader(req);
    if (tenantFromHeader) {
      return tenantFromHeader;
    }

    // 3. Try to get from subdomain
    const tenantFromSubdomain = this.extractFromSubdomain(req);
    if (tenantFromSubdomain) {
      return tenantFromSubdomain;
    }

    // 4. Try to get from query parameter (least secure, use with caution)
    const tenantFromQuery = this.extractFromQuery(req);
    if (tenantFromQuery) {
      return tenantFromQuery;
    }

    return null;
  }

  /**
   * Extract tenant ID from JWT payload
   */
  private async extractFromJwt(req: any): Promise<string | null> {
    try {
      const token = this.extractTokenFromHeader(req);
      if (!token) {
        return null;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      return payload.tenantId || null;
    } catch {
      // Token might be invalid or expired, that's okay
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  private extractTokenFromHeader(req: any): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Extract tenant from custom headers
   * X-Tenant-Code or X-Tenant-Id
   */
  private extractFromHeader(req: any): string | null {
    const tenantCode = req.headers['x-tenant-code'];
    if (tenantCode) {
      return tenantCode;
    }

    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) {
      return tenantId; // Return as string (ID is now CUID)
    }

    return null;
  }

  /**
   * Extract tenant from subdomain
   * Format: {tenant-code}.domain.com
   */
  private extractFromSubdomain(req: any): string | null {
    const host = req.headers.host;
    if (!host) {
      return null;
    }

    // Split hostname and check if subdomain exists
    const parts = host.split('.');
    if (parts.length < 3) {
      // No subdomain (e.g., localhost or domain.com)
      return null;
    }

    // First part is subdomain
    const subdomain = parts[0];

    // Ignore common subdomains
    const ignoredSubdomains = ['www', 'api', 'app', 'localhost'];
    if (ignoredSubdomains.includes(subdomain.toLowerCase())) {
      return null;
    }

    return subdomain;
  }

  /**
   * Extract tenant from query parameter
   * ?tenantCode=PHARM000001
   */
  private extractFromQuery(req: any): string | null {
    return req.query.tenantCode || null;
  }
}
