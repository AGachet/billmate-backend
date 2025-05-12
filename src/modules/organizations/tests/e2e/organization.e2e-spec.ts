/**
 * Resources
 */
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { OrganizationType } from '@prisma/client'
import * as bcrypt from 'bcrypt'
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
import { AuthModule } from '@modules/auth/auth.module'
import { OrganizationsModule } from '@modules/organizations/organizations.module'

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
 * Test Data
 */
const mockUser = {
  id: '1',
  email: 'orgtest@billmate.test',
  isActive: true,
  password: 'TestPassword123',
  peopleId: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockAccount = {
  id: '1',
  name: 'Test Account',
  description: 'Test Account Description',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

/**
 * Test Suite
 */
describe('Organizations Module (e2e)', () => {
  let app: INestApplication
  let prismaService: PrismaService
  let agent: ReturnType<typeof request.agent>
  let createdOrganizationId: string

  beforeAll(async () => {
    // Create NestJS application
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [OrganizationsModule, AuthModule, LoggerModule, EnvModule, PrismaModule, AccountAccessModule]
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix(process.env.API_PREFIX ?? '/api')
    app.use(cookieParser())

    prismaService = moduleRef.get<PrismaService>(PrismaService)

    // Set up test data
    const hashedPassword = await bcrypt.hash(mockUser.password, 10)
    const people = await prismaService.people.create({
      data: {
        firstname: 'Organization',
        lastname: 'Manager',
        email: mockUser.email
      }
    })

    // Find the required roles
    const userRole = await prismaService.role.findFirst({ where: { name: 'user' } })
    const orgAdminRole = await prismaService.role.findFirst({ where: { name: 'organization_administrator' } })

    if (!userRole || !orgAdminRole) {
      throw new Error('Required roles not found')
    }

    // Verify org admin role has required permissions
    const orgAdminRoleWithPermissions = await prismaService.role.findUnique({
      where: { id: orgAdminRole.id },
      include: {
        permissionsLinked: {
          include: {
            permission: true
          }
        }
      }
    })

    // Ensure the role has the required permissions
    const hasOrgCreation = orgAdminRoleWithPermissions?.permissionsLinked.some((link) => link.permission.name === 'ORGANIZATION_CREATION')
    const hasOrgUpdate = orgAdminRoleWithPermissions?.permissionsLinked.some((link) => link.permission.name === 'ORGANIZATION_UPDATE')

    if (!hasOrgCreation || !hasOrgUpdate) {
      // Find the ORGANIZATION_ADMINISTRATION module
      const orgAdminModule = await prismaService.module.findFirst({
        where: { name: 'ORGANIZATION_ADMINISTRATION' }
      })

      if (!orgAdminModule) {
        throw new Error('ORGANIZATION_ADMINISTRATION module not found')
      }

      // Find or create the required permissions
      if (!hasOrgCreation) {
        const orgCreationPerm =
          (await prismaService.modulePermission.findFirst({
            where: { name: 'ORGANIZATION_CREATION' }
          })) ||
          (await prismaService.modulePermission.create({
            data: {
              name: 'ORGANIZATION_CREATION',
              description: 'Create an organization',
              moduleId: orgAdminModule.id
            }
          }))

        // Link permission to role
        await prismaService.rolePermissionLink.create({
          data: {
            roleId: orgAdminRole.id,
            permissionId: orgCreationPerm.id
          }
        })
      }

      if (!hasOrgUpdate) {
        const orgUpdatePerm =
          (await prismaService.modulePermission.findFirst({
            where: { name: 'ORGANIZATION_UPDATE' }
          })) ||
          (await prismaService.modulePermission.create({
            data: {
              name: 'ORGANIZATION_UPDATE',
              description: 'Update an organization',
              moduleId: orgAdminModule.id
            }
          }))

        // Link permission to role
        await prismaService.rolePermissionLink.create({
          data: {
            roleId: orgAdminRole.id,
            permissionId: orgUpdatePerm.id
          }
        })
      }
    }

    // Create user with roles
    const user = await prismaService.user.create({
      data: {
        email: mockUser.email,
        password: hashedPassword,
        isActive: true,
        peopleId: people.id,
        preference: {
          create: {
            locale: 'FR'
          }
        },
        rolesLinked: {
          create: [{ roleId: userRole.id }, { roleId: orgAdminRole.id }]
        }
      }
    })

    // Create account and link with user
    const account = await prismaService.account.create({
      data: {
        name: mockAccount.name,
        description: mockAccount.description,
        isActive: true,
        usersLinked: {
          create: {
            userId: user.id
          }
        }
      }
    })

    // Update mock data with actual IDs
    mockUser.id = user.id
    mockAccount.id = account.id

    await app.init()

    // Create agent for authenticated requests
    agent = request.agent(app.getHttpServer())

    // Login with test user
    await agent.post('/api/auth/signin').send({ email: mockUser.email, password: mockUser.password }).expect(200)

    // Verify user has access to account
    const userAccountLink = await prismaService.userAccountLink.findUnique({
      where: {
        userId_accountId: {
          userId: user.id,
          accountId: account.id
        }
      }
    })

    if (!userAccountLink) {
      await prismaService.userAccountLink.create({
        data: {
          userId: user.id,
          accountId: account.id
        }
      })
    }
  })

  afterAll(async () => {
    // Clean up test data
    if (createdOrganizationId) {
      await prismaService.organization.deleteMany({
        where: { id: createdOrganizationId }
      })
    }
    await prismaService.user.deleteMany({
      where: { email: mockUser.email }
    })
    await prismaService.account.deleteMany({
      where: { id: mockAccount.id }
    })
    await prismaService.$disconnect()
    await app.close()
  })

  describe('Organization Creation', () => {
    it('should successfully create a new organization when authenticated', async () => {
      const createOrganizationDto = {
        name: `Test Organization ${Date.now()}`,
        type: OrganizationType.COMPANY,
        accountId: mockAccount.id,
        description: 'New Test Organization Description',
        website: 'https://www.testorg.com'
      }

      const response = await agent.post('/api/organizations').send(createOrganizationDto).expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name', createOrganizationDto.name)
      expect(response.body).toHaveProperty('type', createOrganizationDto.type)
      expect(response.body).toHaveProperty('description', createOrganizationDto.description)
      expect(response.body).toHaveProperty('website', createOrganizationDto.website)

      // Store created organization ID for other tests
      createdOrganizationId = response.body.id
    })

    it('should reject organization creation when not authenticated', async () => {
      const createOrganizationDto = {
        name: 'Test Organization',
        type: OrganizationType.COMPANY,
        accountId: mockAccount.id
      }

      await request(app.getHttpServer()).post('/api/organizations').send(createOrganizationDto).expect(401)
    })
  })

  describe('Organization Fetch', () => {
    it('should successfully fetch an organization when authenticated', async () => {
      // Skip if no organization was created in the previous test
      if (!createdOrganizationId) {
        return console.warn('Skipping test: no organization was created')
      }

      const response = await agent.get(`/api/organizations/${createdOrganizationId}`).expect(200)

      expect(response.body).toHaveProperty('id', createdOrganizationId)
      expect(response.body).toHaveProperty('name')
      expect(response.body).toHaveProperty('type')
    })

    it('should reject fetching organization when not authenticated', async () => {
      if (!createdOrganizationId) {
        return console.warn('Skipping test: no organization was created')
      }

      await request(app.getHttpServer()).get(`/api/organizations/${createdOrganizationId}`).expect(401)
    })

    it('should return 404 for non-existent organization', async () => {
      await agent.get('/api/organizations/non-existent-id').expect(404)
    })
  })

  describe('Organization Update', () => {
    it('should successfully update an organization when authenticated', async () => {
      if (!createdOrganizationId) {
        return console.warn('Skipping test: no organization was created')
      }

      const updateOrganizationDto = {
        name: `Updated Organization ${Date.now()}`,
        description: 'Updated Test Organization Description'
      }

      const response = await agent.patch(`/api/organizations/${createdOrganizationId}`).send(updateOrganizationDto).expect(200)

      expect(response.body).toHaveProperty('id', createdOrganizationId)
      expect(response.body).toHaveProperty('name', updateOrganizationDto.name)
      expect(response.body).toHaveProperty('description', updateOrganizationDto.description)
    })

    it('should reject updating organization when not authenticated', async () => {
      if (!createdOrganizationId) {
        return console.warn('Skipping test: no organization was created')
      }

      const updateOrganizationDto = {
        name: 'Updated Organization'
      }

      await request(app.getHttpServer()).patch(`/api/organizations/${createdOrganizationId}`).send(updateOrganizationDto).expect(401)
    })

    it('should return 404 for updating non-existent organization', async () => {
      const updateOrganizationDto = {
        name: 'Updated Organization'
      }

      await agent.patch('/api/organizations/non-existent-id').send(updateOrganizationDto).expect(404)
    })
  })
})
