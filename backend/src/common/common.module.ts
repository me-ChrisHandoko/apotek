import { Global, Module } from '@nestjs/common';
import { UuidService } from './services/uuid.service';

/**
 * CommonModule - Global module for shared services
 *
 * Marked as @Global() to make services available across all modules
 * without explicit imports. This eliminates the need to import
 * CommonModule in every feature module that needs UuidService.
 *
 * Usage in any service:
 * ```typescript
 * constructor(private uuid: UuidService) {}
 * ```
 */
@Global()
@Module({
  providers: [UuidService],
  exports: [UuidService],
})
export class CommonModule {}
