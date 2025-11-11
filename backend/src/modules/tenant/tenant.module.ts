import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Tenant Module
 * Provides tenant management services and tenant context resolution
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
