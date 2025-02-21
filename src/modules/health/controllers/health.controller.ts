/**
 * Resources
 */
import { Controller, Get } from '@nestjs/common'

/**
 * Dependencies
 */
import { HealthService } from '@modules/health/services/health.service'

/**
 * Type
 */
import type { HealthCheckResult } from '@nestjs/terminus'

/**
 * Declaration
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthCheckResult> {
    return this.healthService.runHealthChecks()
  }
}
