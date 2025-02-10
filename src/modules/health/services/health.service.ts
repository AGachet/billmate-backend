/**
 * Resources
 */
import { Injectable } from '@nestjs/common'
import { HealthCheckService, HealthCheck as HealthCheckDecorator, HealthCheckResult } from '@nestjs/terminus'

/**
 * Dependencies
 */
import { AppHealthCheck } from '@modules/health/checks/app.health.check'
import { Logger } from '@common/services/logger.service'

/**
 * Declaration
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly appHealthCheck: AppHealthCheck,
    private readonly logger: Logger
  ) {}

  @HealthCheckDecorator()
  async runHealthChecks(): Promise<HealthCheckResult> {
    this.logger.debug('Running health checks...', 'HealthService')
    try {
      const result = await this.health.check([
        () => this.appHealthCheck.isHealthy()
        // TODO: Add other checks here
      ])
      this.logger.debug(`Health checks completed successfully - Status: ${result.status}`, 'HealthService')
      return result
    } catch (error) {
      console.log(error)
      this.logger.error('Health checks failed', error instanceof Error ? error.stack || 'No stack trace available' : 'No error stack', 'HealthService')

      throw error
    }
  }
}
