/**
 * Resources
 */
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { mockChalk, mockWinston } from '@configs/test/unit-mocks-glob'
import { EntityService } from '@modules/entities/services/entity.service'

/**
 * Mocks
 */
jest.mock('@common/services/logger/logger.service')
jest.mock('@configs/prisma/services/prisma.service')
jest.mock('@common/services/account-access/account-access.service')

/**
 * Test Data
 */
const mockUser = {
  id: '1',
  email: 'test@example.com',
  isActive: true,
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

const mockUserAccountLink = {
  userId: mockUser.id,
  accountId: mockAccount.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: mockAccount,
  indirectAccess: false
}

/**
 * Declaration
 */
describe('EntityService', () => {
  let service: EntityService
  let prismaService: jest.Mocked<PrismaService>
  let logger: jest.Mocked<Logger>
  let accountAccessService: jest.Mocked<AccountAccessService>

  beforeEach(async () => {
    // Reset global mocks
    Object.values(mockChalk).forEach((mock: jest.Mock) => mock.mockClear())
    Object.values(mockWinston.format).forEach((mock: jest.Mock) => mock.mockClear())
    mockWinston.createLogger.mockClear()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityService,
        {
          provide: PrismaService,
          useValue: {
            entity: {
              create: jest.fn(),
              findUnique: jest.fn()
            },
            organization: {
              findUnique: jest.fn()
            },
            userEntityLink: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn()
            },
            userAccountLink: {
              findMany: jest.fn()
            },
            $transaction: jest.fn((callback) => callback(prismaService))
          }
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
          }
        },
        {
          provide: AccountAccessService,
          useValue: {
            validateUserAccountAccess: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityService>(EntityService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createEntity', () => {
    it('should create an entity successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      ;(prismaService.entity.create as jest.Mock).mockResolvedValue(mockEntity)

      const createEntityDto = {
        name: 'Test Entity',
        description: 'Test Entity Description',
        accountId: mockAccount.id,
        organizationId: mockOrganization.id
      }

      const result = await service.createEntity(mockUser.id, createEntityDto)

      expect(result).toEqual({
        id: mockEntity.id,
        name: mockEntity.name,
        isActive: mockEntity.isActive,
        createdAt: mockEntity.createdAt,
        updatedAt: mockEntity.updatedAt,
        description: mockEntity.description,
        organization: {
          id: mockOrganization.id,
          name: mockOrganization.name
        }
      })
    })

    it('should throw NotFoundException if organization does not exist', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(null)

      const createEntityDto = {
        name: 'Test Entity',
        description: 'Test Entity Description',
        accountId: mockAccount.id,
        organizationId: 'non-existent-id'
      }

      await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(NotFoundException)
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)

      const createEntityDto = {
        name: 'Test Entity',
        description: 'Test Entity Description',
        accountId: mockAccount.id,
        organizationId: mockOrganization.id
      }

      await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      ;(prismaService.entity.create as jest.Mock).mockRejectedValue(new Error('Database error'))

      const createEntityDto = {
        name: 'Test Entity',
        description: 'Test Entity Description',
        accountId: mockAccount.id,
        organizationId: mockOrganization.id
      }

      await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create entity'), 'createEntity')
    })
  })

  describe('updateEntityUsers', () => {
    const mockEntityWithUsers = {
      ...mockEntity,
      account: mockAccount,
      users: [
        {
          userId: '1',
          user: {
            id: '1',
            email: 'user1@test.com',
            isActive: true,
            people: {
              id: '1',
              firstname: 'John',
              lastname: 'Doe'
            }
          }
        }
      ]
    }

    it('should update entity users successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.entity.findUnique as jest.Mock).mockResolvedValue(mockEntityWithUsers)
      ;(prismaService.userEntityLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userEntityLink.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userEntityLink.findMany as jest.Mock).mockResolvedValue([
        {
          user: {
            id: '2',
            email: 'user2@test.com',
            isActive: true,
            people: {
              id: '2',
              firstname: 'Jane',
              lastname: 'Smith'
            }
          }
        }
      ])
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([
        {
          userId: '2',
          accountId: mockAccount.id
        }
      ])

      const result = await service.updateEntityUsers(mockUser.id, mockEntity.id, ['2'])

      expect(result).toEqual({
        id: mockEntity.id,
        name: mockEntity.name,
        users: [
          {
            id: '2',
            email: 'user2@test.com',
            firstname: 'Jane',
            lastname: 'Smith',
            isActive: true,
            people: {
              id: '2',
              firstname: 'Jane',
              lastname: 'Smith'
            }
          }
        ]
      })
    })

    it('should throw NotFoundException if entity does not exist', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.entity.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.updateEntityUsers(mockUser.id, 'non-existent-id', ['2'])).rejects.toThrow(NotFoundException)
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
      ;(prismaService.entity.findUnique as jest.Mock).mockResolvedValue(mockEntityWithUsers)

      await expect(service.updateEntityUsers(mockUser.id, mockEntity.id, ['2'])).rejects.toThrow(UnauthorizedException)
    })

    it('should throw BadRequestException if removing all users would leave account without active users', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.entity.findUnique as jest.Mock).mockResolvedValue(mockEntityWithUsers)
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([])
      ;(prismaService.userEntityLink.findMany as jest.Mock).mockResolvedValue([])

      await expect(service.updateEntityUsers(mockUser.id, mockEntity.id, [])).rejects.toThrow(
        'Cannot remove all users from the entity as there are no active users linked to the account or other entities'
      )
    })

    it('should handle database error gracefully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.entity.findUnique as jest.Mock).mockResolvedValue(mockEntityWithUsers)
      ;(prismaService.userEntityLink.deleteMany as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.updateEntityUsers(mockUser.id, mockEntity.id, ['2'])).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to manage users for entity'), 'updateEntityUsers')
    })
  })
})
