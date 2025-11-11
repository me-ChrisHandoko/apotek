import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * JWT payload interface
 */
export interface JwtPayload {
  sub: string; // Changed from number to string (using CUID)
  username: string;
  email: string;
  role: string;
  tenantId: string; // Changed from number to string (using CUID)
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and attaches user to request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '',
    });

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Validate JWT payload and return user
   * This method is called after JWT signature verification
   * @param payload - Decoded JWT payload
   * @returns User object (attached to request.user)
   */
  async validate(payload: JwtPayload) {
    // Validate user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Check if account is locked
    if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
      throw new UnauthorizedException('Account is locked');
    }

    // Validate tenant is still active
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Tenant is inactive');
    }

    // Return user without password (will be attached to request.user)
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
