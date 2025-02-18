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
import { LoggerModule } from '@common/services/logger/logger.module'

/**
 * Mocks
 */
jest.mock('@configs/env/env.service', () => ({
  EnvService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'NODE_ENV':
          return 'test'
        case 'API_PREFIX':
          return '/api'
        case 'LOG_LEVEL':
          return 'info'
        case 'LOG_PATH':
          return './logs'
        default:
          return undefined
      }
    }),
    isProduction: jest.fn().mockReturnValue(false),
    isDevelopment: jest.fn().mockReturnValue(false),
    isTest: jest.fn().mockReturnValue(true)
  })),
  EnvConfig: {
    NODE_ENV: 'test',
    API_PREFIX: '/api',
    LOG_LEVEL: 'info',
    LOG_PATH: './logs'
  }
}))

jest.mock('@common/services/logger/logger.service', () => ({
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
      imports: [HealthModule, LoggerModule]
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
