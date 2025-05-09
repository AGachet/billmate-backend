/**
 * Resources
 */
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import * as dotenv from 'dotenv'
import request from 'supertest'

/**
 * Dependencies
 */
import { AccountAccessModule } from '@common/services/account-access/account-access.module'
import { LoggerModule } from '@common/services/logger/logger.module'
import { EnvModule } from '@configs/env/env.module'
import { PrismaModule } from '@configs/prisma/prisma.module'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { AccountsModule } from '@modules/accounts/accounts.module'
import { AuthModule } from '@modules/auth/auth.module'

/**
 * DB setup
 */
import { loginTestUser, setupTestAccounts, TestAccountsSetup } from '@modules/accounts/tests/utils/setup-test-accounts-db'

// Load test environment variables
dotenv.config({ path: '.env.test' })

/**
 * Mocks
 */
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
describe('Accounts Module (e2e)', () => {
  let app: INestApplication
  let prismaService: PrismaService
  let agent: ReturnType<typeof request.agent>
  let testAccounts: TestAccountsSetup

  beforeAll(async () => {
    // Create NestJS application
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AccountsModule, AuthModule, LoggerModule, EnvModule, PrismaModule, AccountAccessModule]
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix(process.env.API_PREFIX ?? '/api')
    app.use(cookieParser())

    prismaService = moduleRef.get<PrismaService>(PrismaService)

    await app.init()

    // Set up test accounts
    testAccounts = await setupTestAccounts(prismaService)

    // Create agent for authenticated requests
    agent = request.agent(app.getHttpServer())

    // Login with test user
    await loginTestUser(agent)
  })

  afterAll(async () => {
    await prismaService.$disconnect()
    await app.close()
  })

  describe('Account Management', () => {
    it('should toggle account 1 status when authenticated', async () => {
      // Check initial account status
      let account = await prismaService.account.findUnique({
        where: { id: testAccounts.account1.id }
      })

      // Toggle account status
      const newState = !testAccounts.account1.isActive
      const response = await agent.patch(`/api/accounts/${testAccounts.account1.id}/status`).send({ isActive: newState }).expect(200)

      // Verify response
      expect(response.body.id).toBe(testAccounts.account1.id)
      expect(response.body.isActive).toBe(newState)

      // Verify database update
      account = await prismaService.account.findUnique({
        where: { id: testAccounts.account1.id }
      })
      expect(account?.isActive).toBe(newState)
    })

    it('should toggle account 2 status when authenticated', async () => {
      // Check initial account status
      let account = await prismaService.account.findUnique({
        where: { id: testAccounts.account2.id }
      })

      // Toggle account status
      const newState = !testAccounts.account2.isActive
      const response = await agent.patch(`/api/accounts/${testAccounts.account2.id}/status`).send({ isActive: newState }).expect(200)

      // Verify response
      expect(response.body.id).toBe(testAccounts.account2.id)
      expect(response.body.isActive).toBe(newState)

      // Verify database update
      account = await prismaService.account.findUnique({
        where: { id: testAccounts.account2.id }
      })
      expect(account?.isActive).toBe(newState)
    })

    it('should reject updates without authentication', async () => {
      // Try to update without authentication (direct request, not using agent)
      await request(app.getHttpServer()).patch(`/api/accounts/${testAccounts.account1.id}/status`).send({ isActive: !testAccounts.account1.isActive }).expect(401)

      // Verify account was not modified since last test
      const account = await prismaService.account.findUnique({
        where: { id: testAccounts.account1.id }
      })
      // Account should still have the state set by the first test (!testAccounts.account1.isActive)
      expect(account?.isActive).toBe(!testAccounts.account1.isActive)
    })
  })
})
