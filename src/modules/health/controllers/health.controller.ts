/**
 * Resources
 */
import { Controller, Get } from '@nestjs/common'

/**
 * Dependencies
 */
import { HealthService } from '@modules/health/services/health.service'

/**
 * Declaration
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.runHealthChecks()
  }
}
