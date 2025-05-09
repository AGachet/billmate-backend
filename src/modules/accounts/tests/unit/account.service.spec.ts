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
        id: mockAccount.id,
        name: mockAccount.name,
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
      expect(logger.debug).toHaveBeenCalledWith(`Updating account ${mockAccount.id} status to inactive for user ${mockUser.id}`, 'updateAccountStatus')
    })

    it('should not update if account is already in desired state', async () => {
      // Mock prisma responses with account already in the correct state
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

      const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, true)

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        isActive: true
      })
      expect(prismaService.account.update).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(`Account ${mockAccount.id} is already active`, 'updateAccountStatus')
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      // Mock user has access but update fails
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.update as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update account'), 'updateAccountStatus')
    })
  })

  describe('updateAccountUsers', () => {
    const mockUsers = [
      { id: '1', email: 'user1@test.com', firstname: 'John', lastname: 'Doe', isActive: true },
      { id: '2', email: 'user2@test.com', firstname: 'Jane', lastname: 'Smith', isActive: true }
    ]

    const mockAccountWithUsers = {
      ...mockAccount,
      usersLinked: mockUsers.map((user) => ({
        userId: user.id,
        user: { ...user, people: { firstname: user.firstname, lastname: user.lastname } }
      })),
      entities: []
    }

    it('should update account users successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
      ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue(
        mockUsers.map((user) => ({
          user: { ...user, people: { firstname: user.firstname, lastname: user.lastname } }
        }))
      )

      const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['1', '2'])

      expect(result).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        users: mockUsers.map((user) => ({
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          people: {
            firstname: user.firstname,
            lastname: user.lastname
          }
        }))
      })
      expect(prismaService.$transaction).toHaveBeenCalled()
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['1', '2'])).rejects.toThrow(UnauthorizedException)
    })

    it('should throw BadRequestException if account would have no active users', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue({
        ...mockAccountWithUsers,
        usersLinked: [],
        entities: []
      })

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, [])).rejects.toThrow(BadRequestException)
    })

    it('should handle database error gracefully', async () => {
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['1', '2'])).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to manage users for account'), 'manageAccountUsers')
    })
  })
})
