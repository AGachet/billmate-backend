/**
 * Resources
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'

/**
 * Dependencies
 */
import { HealthModule } from '@modules/health/health.module'

/**
 * Mock Logger
 */
jest.mock('@common/services/logger.service', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  }))
}))

/**
 * Declaration
 */
describe('Health Check (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule]
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix(process.env.API_PREFIX ?? '/api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health should return health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.body).toEqual({
      status: 'ok',
      info: {
        app: {
          status: 'up',
          uptime: expect.any(Number),
          timestamp: expect.any(String)
        }
      },
      error: {},
      details: {
        app: {
          status: 'up',
          uptime: expect.any(Number),
          timestamp: expect.any(String)
        }
      }
    })
  })
})
