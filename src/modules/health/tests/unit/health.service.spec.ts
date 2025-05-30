/**
 * Resources
 */
import { Provider } from '@nestjs/common'
import { HealthCheckResult, HealthCheckService, HealthIndicatorResult, HealthIndicatorStatus } from '@nestjs/terminus'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { AppHealthCheck } from '@modules/health/checks/app.health.check'
import { HealthService } from '@modules/health/services/health.service'

/**
 * Test infrastructure
 */
import { ServiceTestBase } from '@common/tests/unit/base/service-test-base'
import { mockLogger } from '@common/tests/unit/mocks/service-mocks'
import { TestAssertions, TestScenario } from '@common/tests/unit/utils/advanced-test-utils'

/**
 * Mocks
 */
jest.mock('@nestjs/terminus', () => ({
  HealthCheckService: jest.fn(),
  HealthCheckResult: jest.fn(),
  HealthIndicatorResult: jest.fn(),
  HealthIndicatorStatus: jest.fn(),
  HealthCheck: () => (target: new (...args: unknown[]) => unknown) => target
}))

jest.mock('@modules/health/checks/app.health.check')

/**
 * Test Data
 */
const mockHealthResult: HealthIndicatorResult = {
  app: {
    status: 'up' as HealthIndicatorStatus,
    uptime: 123,
    timestamp: '2024-03-05T12:00:00.000Z'
  }
}

/**
 * Test implementation using the new infrastructure
 */
class HealthServiceTest extends ServiceTestBase<HealthService> {
  private healthCheckService: jest.Mocked<HealthCheckService>
  private appHealthCheck: jest.Mocked<AppHealthCheck>
  private logger: jest.Mocked<Logger>

  protected getServiceClass() {
    return HealthService
  }

  protected getProviders(): Provider[] {
    return [
      {
        provide: HealthCheckService,
        useValue: {
          check: jest.fn()
        }
      },
      {
        provide: AppHealthCheck,
        useValue: {
          isHealthy: jest.fn()
        }
      },
      {
        provide: Logger,
        useValue: mockLogger
      }
    ]
  }

  protected async customSetup(): Promise<void> {
    // Get service references
    this.healthCheckService = this.getService(HealthCheckService)
    this.appHealthCheck = this.getService(AppHealthCheck)
    this.logger = this.getService(Logger)
  }

  /**
   * Test runHealthChecks functionality
   */
  testRunHealthChecks(): void {
    describe('runHealthChecks', () => {
      describe('when successful', () => {
        const successScenario = TestScenario.create('successful health checks', async () => {
          const mockResult: HealthCheckResult = {
            status: 'ok',
            info: {
              app: {
                status: 'up' as HealthIndicatorStatus,
                uptime: 123,
                timestamp: '2024-03-05T12:00:00.000Z'
              }
            },
            error: {},
            details: {
              app: {
                status: 'up' as HealthIndicatorStatus,
                uptime: 123,
                timestamp: '2024-03-05T12:00:00.000Z'
              }
            }
          }

          this.healthCheckService.check.mockResolvedValue(mockResult)
          this.appHealthCheck.isHealthy.mockResolvedValue(mockHealthResult)
        })

        it('should run health checks successfully', async () => {
          await successScenario.execute(async () => {
            // Act
            const result = await this.service.runHealthChecks()

            // Assert
            expect(result).toEqual(
              expect.objectContaining({
                status: 'ok',
                info: expect.any(Object),
                error: expect.any(Object),
                details: expect.any(Object)
              })
            )

            // Verify
            expect(this.logger.debug).toHaveBeenCalledWith('Running health checks...', 'HealthService')
            expect(this.logger.debug).toHaveBeenCalledWith('Health checks passed - Status: ok', 'HealthService')
          })
        })
      })

      describe('when errors occur', () => {
        const errorScenario = TestScenario.create('health check failure', async () => {
          const error = new Error('Health check failed')
          this.healthCheckService.check.mockRejectedValue(error)
        })

        it('should handle health check failures', async () => {
          await errorScenario.execute(async () => {
            // Act & Assert
            await TestAssertions.assertThrows(() => this.service.runHealthChecks(), Error, 'Health check failed')

            // Verify
            expect(this.logger.error).toHaveBeenCalledWith('Health checks failed: Health check failed', expect.any(String), 'HealthService')
          })
        })
      })
    })
  }
}

// Execute the tests
describe('HealthService (Refactored)', () => {
  const healthServiceTest = new HealthServiceTest()

  beforeEach(async () => {
    await healthServiceTest.setupTest()
  })

  afterEach(async () => {
    await healthServiceTest.cleanupTest()
  })

  // Run all test suites
  healthServiceTest.testRunHealthChecks()
})
