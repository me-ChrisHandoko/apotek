import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UuidService } from '../../common/services/uuid.service';
import { User, Tenant } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { generateToken } from '../../common/utils/token.util';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetRequestDto, PasswordResetDto } from './dto/password-reset.dto';

/**
 * Authentication service
 * Handles user authentication, registration, and password management
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private uuid: UuidService,
  ) {}

  /**
   * Validate user credentials
   * @param username - Username or email
   * @param password - Plain text password
   * @param tenantId - Optional tenant ID for validation
   * @returns User without password or null
   */
  async validateUser(
    username: string,
    password: string,
    tenantId?: string,
  ): Promise<Omit<User, 'password'> | null> {
    try {
      // Find user by username or email (case-insensitive)
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: username, mode: 'insensitive' } },
            { email: { equals: username, mode: 'insensitive' } },
          ],
          ...(tenantId && { tenantId }),
        },
        include: {
          tenant: true,
        },
      });

      if (!user) {
        return null;
      }

      // Check if user is active
      if (!user.isActive) {
        this.logger.warn(`Inactive user attempted login: ${username}`);
        return null;
      }

      // Check if account is locked
      if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
        this.logger.warn(`Locked account attempted login: ${username}`);
        throw new UnauthorizedException(
          `Account is locked until ${user.accountLockedUntil.toISOString()}`,
        );
      }

      // Check if tenant is active
      if (!user.tenant.isActive) {
        this.logger.warn(`User from inactive tenant attempted login: ${username}`);
        throw new UnauthorizedException('Tenant is inactive');
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        // Handle failed login
        await this.handleFailedLogin(user.id);
        return null;
      }

      // Reset failed login attempts on successful validation
      if (user.failedLoginAttempts > 0) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            accountLockedUntil: null,
          },
        });
      }

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Login user and generate tokens
   * @param loginDto - Login credentials
   * @returns Access token, refresh token, and user info
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password, tenantCode } = loginDto;

    // Get tenant ID from code if provided
    let tenantId: string | undefined;
    if (tenantCode) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { code: tenantCode },
      });

      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException('Invalid tenant');
      }

      tenantId = tenant.id;
    }

    // Validate user credentials
    const user = await this.validateUser(username, password, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    // Log successful login
    this.logger.log(`User logged in successfully: ${user.username} (ID: ${user.id})`);

    // Get tenant info separately
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenExpiration(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      },
    };
  }

  /**
   * Register new user
   * @param registerDto - User registration data
   * @returns Created user without password
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { username, email, password, fullName, role, phone, tenantId } = registerDto;

    // Tenant ID is required
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new BadRequestException('Invalid tenant');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Tenant is inactive');
    }

    // Check username uniqueness per tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists in this tenant');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullName,
        role: role || 'CASHIER',
        phone,
        tenantId: tenantId!,
        isActive: true,
        failedLoginAttempts: 0,
      },
      include: {
        tenant: true,
      },
    });

    this.logger.log(`User registered successfully: ${user.username} (ID: ${user.id})`);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Logout user by revoking refresh token
   * @param refreshToken - Refresh token to revoke
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      // Verify and decode token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Revoke token in database
      await this.prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          userId: payload.sub,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      this.logger.log(`User logged out successfully: ${payload.sub}`);
    } catch (error) {
      // Token might be invalid or expired, but that's okay for logout
      this.logger.warn(`Logout with invalid token: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Valid refresh token
   * @returns New access token (and optionally new refresh token)
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    expiresIn: number;
  }> {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Check if token exists and not revoked
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          revoked: false,
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      if (!user.tenant.isActive) {
        throw new UnauthorizedException('Tenant is inactive');
      }

      // Generate new access token
      const { password: _, ...userWithoutPassword } = user;
      const newAccessToken = this.generateAccessToken(userWithoutPassword);

      this.logger.log(`Access token refreshed for user: ${user.id}`);

      return {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: this.getAccessTokenExpiration(),
      };
    } catch (error) {
      this.logger.error(`Error refreshing token: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Request password reset
   * @param dto - Password reset request with email
   */
  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const { email } = dto;

    // Find user by email (don't reveal if user exists)
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      // Don't reveal if user exists
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generate reset token
    const resetToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    // Store reset token with UUID v7 (time-ordered for audit compliance)
    await this.prisma.passwordResetToken.create({
      data: {
        id: this.uuid.generateV7(),
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // TODO: Send email with reset link
    this.logger.log(`Password reset token generated for user: ${user.id}`);
    this.logger.debug(`Reset token: ${resetToken}`); // Remove in production
  }

  /**
   * Reset password using token
   * @param dto - Password reset data with token and new password
   */
  async resetPassword(dto: PasswordResetDto): Promise<void> {
    const { token, newPassword } = dto;

    // Find valid token
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });

    // Mark token as used
    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revoked: false },
      data: { revoked: true },
    });

    this.logger.log(`Password reset successfully for user: ${resetToken.userId}`);
  }

  /**
   * Handle failed login attempt
   * @param userId - User ID
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const maxAttempts = parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5', 10);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const failedAttempts = user.failedLoginAttempts + 1;

    // Lock account if max attempts reached
    if (failedAttempts >= maxAttempts) {
      const lockoutDuration = 30; // 30 minutes
      const accountLockedUntil = new Date();
      accountLockedUntil.setMinutes(accountLockedUntil.getMinutes() + lockoutDuration);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: failedAttempts,
          accountLockedUntil,
        },
      });

      this.logger.warn(
        `Account locked due to ${maxAttempts} failed attempts: User ID ${userId}`,
      );
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: failedAttempts },
      });
    }
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: Omit<User, 'password'>): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(user: Omit<User, 'password'>): string {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    // @ts-ignore - TypeScript strict type checking for JWT sign options
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '',
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    });
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        id: this.uuid.generateV7(),
        token,
        userId,
        expiresAt,
        revoked: false,
      },
    });
  }

  /**
   * Get access token expiration in seconds
   */
  private getAccessTokenExpiration(): number {
    const expiration = process.env.JWT_EXPIRATION || '15m';
    const match = expiration.match(/^(\d+)([smhd])$/);

    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const unitToSeconds = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * unitToSeconds[unit];
  }
}
