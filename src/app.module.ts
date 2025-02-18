/**
 * Resources
 */
import { Module } from '@nestjs/common'

/**
 * Dependencies
 */
import { HealthModule } from '@modules/health/health.module'
import { PrismaModule } from '@configs/prisma/prisma.module'
import { Logger } from '@common/services/logger.service'
import { AuthModule } from './modules/auth/auth.module'

/**
 * Declaration
 */
@Module({
  imports: [HealthModule, PrismaModule, AuthModule],
  controllers: [],
  providers: [Logger],
  exports: [Logger]
})
export class AppModule {}
