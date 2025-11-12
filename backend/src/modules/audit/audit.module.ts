import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { ExportService } from './utils/export.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditAccessGuard } from './guards/audit-access.guard';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    ExportService,
    AuditLogInterceptor,
    AuditAccessGuard,
  ],
  exports: [AuditService, AuditLogInterceptor],
})
export class AuditModule {}
