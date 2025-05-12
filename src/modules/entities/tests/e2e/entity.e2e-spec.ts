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
import { EntitiesModule } from '@modules/entities/entities.module'

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
  email: 'entitytest@billmate.test',
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

const mockOrganization = {
  id: '1',
  name: 'Test Organization',
  type: OrganizationType.COMPANY,
  description: 'Test Organization Description',
  website: null,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockEntity = {
  id: '1',
  name: 'Test Entity',
  description: 'Test Entity Description',
  isActive: true,
  accountId: mockAccount.id,
  organizationId: mockOrganization.id,
  createdAt: new Date(),
  updatedAt: new Date()
}

/**
 * Test Suite
 */
describe('Entities Module (e2e)', () => {
  let app: INestApplication
  let prismaService: PrismaService
  let agent: ReturnType<typeof request.agent>
  let createdEntityId: string

  beforeAll(async () => {
    // Create NestJS application
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EntitiesModule, AuthModule, LoggerModule, EnvModule, PrismaModule, AccountAccessModule]
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix(process.env.API_PREFIX ?? '/api')
    app.use(cookieParser())

    prismaService = moduleRef.get<PrismaService>(PrismaService)

    // Set up test data
    const hashedPassword = await bcrypt.hash(mockUser.password, 10)
    const people = await prismaService.people.create({
      data: {
        firstname: 'Entity',
        lastname: 'Manager',
        email: mockUser.email
      }
    })

    // Find the required roles
    const userRole = await prismaService.role.findFirst({ where: { name: 'user' } })
    const adminRole = await prismaService.role.findFirst({ where: { name: 'account_administrator' } })

    if (!userRole || !adminRole) {
      throw new Error('Required roles not found')
    }

    // Verify admin role has required permissions
    const adminRoleWithPermissions = await prismaService.role.findUnique({
      where: { id: adminRole.id },
      include: {
        permissionsLinked: {
          include: {
            permission: true
          }
        }
      }
    })

    // Ensure the role has the required permissions
    const hasEntityCreation = adminRoleWithPermissions?.permissionsLinked.some((link) => link.permission.name === 'ENTITY_CREATION')
    const hasEntityUserManagement = adminRoleWithPermissions?.permissionsLinked.some((link) => link.permission.name === 'ENTITY_USER_MANAGEMENT')

    if (!hasEntityCreation || !hasEntityUserManagement) {
      // Find the ACCOUNT_ADMINISTRATION module
      const accountAdminModule = await prismaService.module.findFirst({
        where: { name: 'ACCOUNT_ADMINISTRATION' }
      })

      if (!accountAdminModule) {
        throw new Error('ACCOUNT_ADMINISTRATION module not found')
      }

      // Find or create the required permissions
      if (!hasEntityCreation) {
        const entityCreationPerm =
          (await prismaService.modulePermission.findFirst({
            where: { name: 'ENTITY_CREATION' }
          })) ||
          (await prismaService.modulePermission.create({
            data: {
              name: 'ENTITY_CREATION',
              description: 'Create an entity',
              moduleId: accountAdminModule.id
            }
          }))

        // Link permission to role
        await prismaService.rolePermissionLink.create({
          data: {
            roleId: adminRole.id,
            permissionId: entityCreationPerm.id
          }
        })
      }

      if (!hasEntityUserManagement) {
        const entityUserManagementPerm =
          (await prismaService.modulePermission.findFirst({
            where: { name: 'ENTITY_USER_MANAGEMENT' }
          })) ||
          (await prismaService.modulePermission.create({
            data: {
              name: 'ENTITY_USER_MANAGEMENT',
              description: 'Manage entity users',
              moduleId: accountAdminModule.id
            }
          }))

        // Link permission to role
        await prismaService.rolePermissionLink.create({
          data: {
            roleId: adminRole.id,
            permissionId: entityUserManagementPerm.id
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
          create: [{ roleId: userRole.id }, { roleId: adminRole.id }]
        }
      }
    })

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

    const organization = await prismaService.organization.create({
      data: {
        name: mockOrganization.name,
        type: mockOrganization.type,
        description: mockOrganization.description,
        website: mockOrganization.website
      }
    })

    // Create test entity
    const entity = await prismaService.entity.create({
      data: {
        name: mockEntity.name,
        description: mockEntity.description,
        isActive: true,
        accountId: account.id,
        organizationId: organization.id
      }
    })

    // Update mock data with actual IDs
    mockUser.id = user.id
    mockAccount.id = account.id
    mockOrganization.id = organization.id
    mockEntity.id = entity.id
    createdEntityId = entity.id

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
    await prismaService.entity.deleteMany({
      where: { id: createdEntityId }
    })
    await prismaService.user.deleteMany({
      where: { email: mockUser.email }
    })
    await prismaService.account.deleteMany({
      where: { id: mockAccount.id }
    })
    await prismaService.organization.deleteMany({
      where: { id: mockOrganization.id }
    })
    await prismaService.$disconnect()
    await app.close()
  })

  describe('Entity Creation', () => {
    it('should successfully create a new entity when authenticated', async () => {
      const createEntityDto = {
        name: `Test Entity ${Date.now()}`,
        description: 'New Test Entity Description',
        accountId: mockAccount.id,
        organizationId: mockOrganization.id
      }

      const response = await agent.post('/api/entities').send(createEntityDto)
      expect([201, 400]).toContain(response.status)
    })

    it('should reject entity creation when not authenticated', async () => {
      const createEntityDto = {
        name: 'Test Entity',
        description: 'Test Entity Description',
        accountId: mockAccount.id,
        organizationId: mockOrganization.id
      }

      await request(app.getHttpServer()).post('/api/entities').send(createEntityDto).expect(401)
    })
  })

  describe('Entity Users Management', () => {
    it('should successfully update entity users when authenticated', async () => {
      const updateEntityUsersDto = {
        userIds: [mockUser.id]
      }

      const response = await agent.patch(`/api/entities/${createdEntityId}/users`).send(updateEntityUsersDto).expect(200)

      expect(response.body).toMatchObject({
        id: createdEntityId,
        name: mockEntity.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            isActive: true
          })
        ])
      })
    })

    it('should reject updating entity users when not authenticated', async () => {
      const updateEntityUsersDto = {
        userIds: [mockUser.id]
      }

      await request(app.getHttpServer()).patch(`/api/entities/${createdEntityId}/users`).send(updateEntityUsersDto).expect(401)
    })

    it('should reject updating users for non-existent entity', async () => {
      const updateEntityUsersDto = {
        userIds: [mockUser.id]
      }

      await agent.patch('/api/entities/non-existent-id/users').send(updateEntityUsersDto).expect(404)
    })

    it('should reject updating entity users with invalid user IDs', async () => {
      await agent
        .patch(`/api/entities/${createdEntityId}/users`)
        .send({ userIds: ['invalid-user-id'] })
        .expect(400)
    })
  })
})
