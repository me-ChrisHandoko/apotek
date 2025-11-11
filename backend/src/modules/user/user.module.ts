import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * User Module
 * Manages user-related functionality
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule, // Required for JWT extraction in guards
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
