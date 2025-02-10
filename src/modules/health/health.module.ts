/**
 * Resources
 */
import { TerminusModule } from '@nestjs/terminus'
import { Module } from '@nestjs/common'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger.service'
import { HealthService } from '@modules/health/services/health.service'
import { AppHealthCheck } from '@modules/health/checks/app.health.check'
import { HealthController } from '@modules/health/controllers/health.controller'

/**
 * Declaration
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthService, AppHealthCheck, Logger]
})
export class HealthModule {}
