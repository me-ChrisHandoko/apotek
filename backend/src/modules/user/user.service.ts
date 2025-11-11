import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import {
  PaginatedResponse,
  createPaginationMeta,
  calculateSkip,
} from '../../common/dto/pagination.dto';

/**
 * User Service
 * Manages user CRUD operations within tenant boundaries
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create new user
   * @param tenantId - Tenant ID
   * @param createUserDto - User data
   * @returns Created user without password
   */
  async create(
    tenantId: string,
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const { username, email, password, fullName, role, phone } = createUserDto;

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
        role: role || UserRole.CASHIER,
        phone,
        tenantId,
        isActive: true,
        failedLoginAttempts: 0,
      },
      include: {
        tenant: true,
      },
    });

    this.logger.log(
      `User created: ${user.username} (ID: ${user.id}) in tenant ${tenantId}`,
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find all users in tenant with pagination
   * @param tenantId - Tenant ID
   * @param query - Query parameters
   * @returns Paginated users
   */
  async findAll(
    tenantId: string,
    query: UserQueryDto,
  ): Promise<PaginatedResponse<Omit<User, 'password'>>> {
    const { page = 1, limit = 20, role, isActive, search } = query;
    const skip = calculateSkip(page, limit);

    // Build where clause (CRITICAL: always include tenantId)
    const where: any = { tenantId };

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.user.count({ where });

    // Get users without passwords
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        failedLoginAttempts: true,
        accountLockedUntil: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const meta = createPaginationMeta(total, page, limit);

    return { items: users as any, meta };
  }

  /**
   * Find user by ID within tenant
   * @param tenantId - Tenant ID
   * @param id - User ID
   * @returns User without password
   */
  async findOne(
    tenantId: string,
    id: string,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find user by username within tenant (includes password for auth)
   * @param tenantId - Tenant ID
   * @param username - Username
   * @returns User with password or null
   */
  async findByUsername(
    tenantId: string,
    username: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        tenantId,
      },
      include: { tenant: true },
    });
  }

  /**
   * Update user
   * @param tenantId - Tenant ID
   * @param id - User ID
   * @param updateUserDto - Update data
   * @param currentUser - Current authenticated user
   * @returns Updated user
   */
  async update(
    tenantId: string,
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: any,
  ): Promise<Omit<User, 'password'>> {
    // Validate user exists in tenant
    const user = await this.findOne(tenantId, id);

    // Check permissions
    const isSelfUpdate = currentUser.id === id;
    const isAdmin = currentUser.role === UserRole.ADMIN;

    // Self-update: only allow certain fields
    if (isSelfUpdate && !isAdmin) {
      const allowedFields = ['fullName', 'email', 'phone'];
      const requestedFields = Object.keys(updateUserDto);
      const forbiddenFields = requestedFields.filter(
        (field) => !allowedFields.includes(field),
      );

      if (forbiddenFields.length > 0) {
        throw new ForbiddenException(
          `You can only update: ${allowedFields.join(', ')}`,
        );
      }
    }

    // Prevent last admin role change
    if (updateUserDto.role && user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (adminCount === 1) {
        throw new BadRequestException('Cannot change role of last active admin');
      }
    }

    // Update user
    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      include: { tenant: true },
    });

    this.logger.log(`User updated: ${updated.username} (ID: ${updated.id})`);

    const { password: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  /**
   * Change user password
   * @param tenantId - Tenant ID
   * @param id - User ID
   * @param dto - Password change data
   * @param currentUser - Current authenticated user
   */
  async changePassword(
    tenantId: string,
    id: string,
    dto: ChangePasswordDto,
    currentUser: any,
  ): Promise<void> {
    const { oldPassword, newPassword, confirmPassword } = dto;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Get user with password
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isSelfUpdate = currentUser.id === id;
    const isAdmin = currentUser.role === UserRole.ADMIN;

    // Non-admin must provide old password
    if (isSelfUpdate && !isAdmin) {
      if (!oldPassword) {
        throw new BadRequestException('Old password is required');
      }

      const isValid = await verifyPassword(oldPassword, user.password);
      if (!isValid) {
        throw new BadRequestException('Old password is incorrect');
      }
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });

    this.logger.log(`Password changed for user: ${user.username} (ID: ${id})`);
  }

  /**
   * Deactivate user
   * @param tenantId - Tenant ID
   * @param id - User ID
   * @param currentUser - Current authenticated user
   */
  async deactivate(
    tenantId: string,
    id: string,
    currentUser: any,
  ): Promise<Omit<User, 'password'>> {
    // Prevent self-deactivation
    if (currentUser.id === id) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const user = await this.findOne(tenantId, id);

    // Prevent last admin deactivation
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (adminCount === 1) {
        throw new BadRequestException('Cannot deactivate last active admin');
      }
    }

    // Deactivate user
    const deactivated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { tenant: true },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });

    this.logger.warn(
      `User deactivated: ${deactivated.username} (ID: ${id}) by user ${currentUser.id}`,
    );

    const { password: _, ...userWithoutPassword } = deactivated;
    return userWithoutPassword;
  }

  /**
   * Activate user
   * @param tenantId - Tenant ID
   * @param id - User ID
   */
  async activate(
    tenantId: string,
    id: string,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findOne(tenantId, id);

    if (user.isActive) {
      throw new BadRequestException('User is already active');
    }

    const activated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
      include: { tenant: true },
    });

    this.logger.log(`User activated: ${activated.username} (ID: ${id})`);

    const { password: _, ...userWithoutPassword } = activated;
    return userWithoutPassword;
  }
}
