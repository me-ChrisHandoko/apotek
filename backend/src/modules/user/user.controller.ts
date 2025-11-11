import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UserRole, User } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';

/**
 * User Controller
 * Manages user operations within tenant boundaries
 * All endpoints require authentication except where @Public() is used
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create new user
   * Only ADMIN and MANAGER can create users
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new user',
    description: 'Create a new user within the current tenant',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Username already exists in this tenant',
  })
  async create(
    @CurrentTenant('id') tenantId: string,
    @Body() createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.create(tenantId, createUserDto);
  }

  /**
   * Get all users with pagination and filters
   * Only ADMIN and MANAGER can list all users
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List all users',
    description: 'Get paginated list of users within the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async findAll(
    @CurrentTenant('id') tenantId: string,
    @Query() query: UserQueryDto,
  ): Promise<PaginatedResponse<Omit<User, 'password'>>> {
    return this.userService.findAll(tenantId, query);
  }

  /**
   * Get current user profile
   * Any authenticated user can access their own profile
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getMe(
    @CurrentTenant('id') tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.findOne(tenantId, userId);
  }

  /**
   * Get user by ID
   * ADMIN and MANAGER can view any user, others can only view themselves
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Get user details by ID within the current tenant',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(
    @CurrentTenant('id') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ): Promise<Omit<User, 'password'>> {
    // Users can only view their own profile unless they're ADMIN/MANAGER
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.MANAGER &&
      currentUser.id !== id
    ) {
      // Return their own profile instead
      return this.userService.findOne(tenantId, currentUser.id);
    }

    return this.userService.findOne(tenantId, id);
  }

  /**
   * Update user
   * Users can update their own limited fields, ADMIN can update any field
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user details (permissions vary by role)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async update(
    @CurrentTenant('id') tenantId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.update(tenantId, id, updateUserDto, currentUser);
  }

  /**
   * Change user password
   * Users can change their own password, ADMIN can reset any password
   */
  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change user password',
    description:
      'Change user password (requires old password for self, not for ADMIN)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: 'number',
  })
  @ApiResponse({
    status: 204,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async changePassword(
    @CurrentTenant('id') tenantId: string,
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() currentUser: any,
  ): Promise<void> {
    return this.userService.changePassword(
      tenantId,
      id,
      changePasswordDto,
      currentUser,
    );
  }

  /**
   * Deactivate user
   * Only ADMIN can deactivate users
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Deactivate a user account (ADMIN only)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User deactivated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate (self or last admin)',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deactivate(
    @CurrentTenant('id') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.deactivate(tenantId, id, currentUser);
  }

  /**
   * Activate user
   * Only ADMIN can activate users
   */
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Activate user',
    description: 'Activate a previously deactivated user account (ADMIN only)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User activated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'User is already active',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async activate(
    @CurrentTenant('id') tenantId: string,
    @Param('id') id: string,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.activate(tenantId, id);
  }
}
