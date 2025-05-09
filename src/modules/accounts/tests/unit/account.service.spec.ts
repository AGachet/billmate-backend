/**
 * Resources
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { mockChalk, mockWinston } from '@configs/test/unit-mocks-glob'
import { AccountService } from '@modules/accounts/services/account.service'

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
  email: 'batman@diamondforge.fr',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockAccount = {
  id: '1',
  name: 'Wayne Enterprises',
  description: 'Main business account',
  isActive: true,
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

const mockRole = {
  id: 1,
  name: 'Admin',
  isActive: true,
  accountId: mockAccount.id,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockEntity = {
  id: '1',
  name: 'Gotham Branch',
  description: 'Main office in Gotham',
  isActive: true,
  accountId: mockAccount.id,
  organizationId: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: '1',
    name: 'Wayne Corp',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * Declaration
 */
describe('AccountService', () => {
  let service: AccountService
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
        AccountService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn()
            },
            userAccountLink: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn()
            },
            user: {
              findMany: jest.fn()
            },
            role: {
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

    service = module.get<AccountService>(AccountService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchAccountDeep', () => {
    const mockUserWithDetails = {
      ...mockUser,
      people: {
        firstname: 'Bruce',
        lastname: 'Wayne'
      },
      rolesLinked: [
        {
          role: mockRole
        }
      ],
      entitiesLinked: [
        {
          entity: mockEntity
        }
      ]
    }

    const mockAccountWithDetails = {
      ...mockAccount,
      usersLinked: [
        {
          user: mockUserWithDetails
        }
      ],
      entities: [mockEntity],
      roles: [mockRole]
    }

    it('should fetch account details successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithDetails)
      ;(prismaService.role.findMany as jest.Mock).mockResolvedValue([])

      const result = await service.fetchAccountDeep(mockUser.id, mockAccount.id)

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        description: mockAccount.description,
        isActive: mockAccount.isActive,
        createdAt: mockAccount.createdAt,
        updatedAt: mockAccount.updatedAt,
        users: [
          {
            id: mockUser.id,
            email: mockUser.email,
            isActive: mockUser.isActive,
            people: {
              firstname: 'Bruce',
              lastname: 'Wayne'
            },
            roles: [
              {
                id: 1,
                name: 'Admin'
              }
            ],
            entityIds: [mockEntity.id]
          }
        ],
        entities: [
          {
            id: mockEntity.id,
            name: mockEntity.name,
            description: mockEntity.description,
            isActive: mockEntity.isActive,
            organization: {
              id: mockEntity.organization.id,
              name: mockEntity.organization.name
            }
          }
        ],
        roles: [
          {
            id: mockRole.id,
            name: mockRole.name,
            isActive: mockRole.isActive,
            isGlobal: false
          }
        ]
      })
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow(UnauthorizedException)
    })

    it('should throw NotFoundException if account does not exist', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow('Account with ID 1 not found')
    })

    it('should handle database error gracefully', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get account details'), 'getAccountDetails')
    })
  })

  describe('updateAccountStatus', () => {
    it('should update account status successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.update as jest.Mock).mockResolvedValue({
        ...mockAccount,
        isActive: false
      })

      const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, false)

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        isActive: false
      })
      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: { isActive: false }
      })
    })

    it('should not update if account is already in desired state', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

      const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, true)

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        isActive: true
      })
      expect(prismaService.account.update).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.update as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update account'), 'updateAccountStatus')
    })
  })

  describe('updateAccountUsers', () => {
    const mockAccountWithUsers = {
      ...mockAccount,
      usersLinked: [
        {
          userId: mockUser.id,
          accountId: mockAccount.id,
          user: {
            ...mockUser,
            people: {
              firstname: 'Bruce',
              lastname: 'Wayne'
            }
          }
        }
      ],
      entities: [
        {
          ...mockEntity,
          users: [
            {
              user: mockUser
            }
          ]
        }
      ]
    }

    const mockNewUsers = [
      {
        id: '2',
        email: 'user2@test.com',
        isActive: true,
        people: {
          firstname: 'Jane',
          lastname: 'Doe'
        }
      },
      {
        id: '3',
        email: 'user3@test.com',
        isActive: true,
        people: {
          firstname: 'John',
          lastname: 'Smith'
        }
      }
    ]

    it('should update account users successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockResolvedValue({ count: 2 })
      ;(prismaService.user.findMany as jest.Mock).mockResolvedValue(mockNewUsers)
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue(
        mockNewUsers.map((user) => ({
          user: {
            ...user,
            people: user.people
          }
        }))
      )
      ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prismaService)
      })

      const newUserIds = ['2', '3']
      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, newUserIds)

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            email: 'user2@test.com',
            isActive: true,
            people: {
              firstname: 'Jane',
              lastname: 'Doe'
            }
          }),
          expect.objectContaining({
            id: '3',
            email: 'user3@test.com',
            isActive: true,
            people: {
              firstname: 'John',
              lastname: 'Smith'
            }
          })
        ])
      })
      expect(prismaService.$transaction).toHaveBeenCalled()
      expect(prismaService.userAccountLink.deleteMany).toHaveBeenCalled()
      expect(prismaService.userAccountLink.createMany).toHaveBeenCalled()
    })

    it('should handle partial update (add and remove users simultaneously)', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.user.findMany as jest.Mock).mockResolvedValue([mockNewUsers[0]])
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([
        {
          user: {
            ...mockNewUsers[0],
            people: mockNewUsers[0].people
          }
        }
      ])
      ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prismaService)
      })

      // Remove current user and add a new one
      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            email: 'user2@test.com',
            isActive: true,
            people: {
              firstname: 'Jane',
              lastname: 'Doe'
            }
          })
        ])
      })
      expect(prismaService.userAccountLink.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [mockUser.id] },
          accountId: mockAccount.id
        }
      })
      expect(prismaService.userAccountLink.createMany).toHaveBeenCalledWith({
        data: [{ userId: '2', accountId: mockAccount.id }]
      })
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['2', '3'])).rejects.toThrow(UnauthorizedException)
    })

    it('should throw NotFoundException if account does not exist', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['2', '3'])).rejects.toThrow('Account with ID 1 not found')
    })

    it('should throw BadRequestException if update would leave account without active users', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue({
        ...mockAccountWithUsers,
        usersLinked: [], // No direct users
        entities: [] // No entities with users
      })

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, [])).rejects.toThrow(
        'Cannot update users as it would leave the account without any active users (directly or via active entities)'
      )
    })

    it('should handle case where some users do not exist', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockRejectedValue(new Error('Foreign key constraint failed'))

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['999'])).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to manage users for account'), 'manageAccountUsers')
    })

    it('should handle users with inactive status', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.user.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockNewUsers[0],
          isActive: false
        }
      ])
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([
        {
          user: {
            ...mockNewUsers[0],
            isActive: false,
            people: mockNewUsers[0].people
          }
        }
      ])
      ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prismaService)
      })

      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            email: 'user2@test.com',
            isActive: false,
            people: {
              firstname: 'Jane',
              lastname: 'Doe'
            }
          })
        ])
      })
    })

    it('should handle users with missing people data', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.user.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockNewUsers[0],
          people: null
        }
      ])
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([
        {
          user: {
            ...mockNewUsers[0],
            people: null
          }
        }
      ])
      ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prismaService)
      })

      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            email: 'user2@test.com',
            isActive: true,
            people: null
          })
        ])
      })
    })

    it('should handle users with entity associations', async () => {
      const mockAccountWithEntityUsers = {
        ...mockAccountWithUsers,
        entities: [
          {
            ...mockEntity,
            users: [
              {
                user: {
                  ...mockNewUsers[0],
                  people: mockNewUsers[0].people
                }
              }
            ]
          }
        ]
      }

      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithEntityUsers)
      ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.userAccountLink.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prismaService.user.findMany as jest.Mock).mockResolvedValue([mockNewUsers[0]])
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue([
        {
          user: {
            ...mockNewUsers[0],
            people: mockNewUsers[0].people
          }
        }
      ])
      ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prismaService)
      })

      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            email: 'user2@test.com',
            isActive: true,
            people: {
              firstname: 'Jane',
              lastname: 'Doe'
            }
          })
        ])
      })
    })
  })
})
