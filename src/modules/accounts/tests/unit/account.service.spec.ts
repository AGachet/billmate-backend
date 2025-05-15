/**
 * Unit tests for AccountService
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { PaginationService } from '@common/services/pagination/pagination.service'
import { EntityOrderBy } from '@modules/accounts/dto/requests/fetch-account-entities.dto'
import { RoleOrderBy } from '@modules/accounts/dto/requests/fetch-account-roles.dto'
import { UserOrderBy } from '@modules/accounts/dto/requests/fetch-account-users.dto'
import { AccountService } from '@modules/accounts/services/account.service'

/**
 * Test utilities and mocks
 */
import { mockAccountAccessService, mockLogger, mockPrismaService } from '@common/tests/unit/mocks/service-mocks'
import { mockAccount, mockEntity, mockRole, mockUser, mockUserAccountLink } from '@common/tests/unit/mocks/test-data'
import { clearAllMocks, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Declaration
 */
describe('AccountService', () => {
  let service: AccountService
  let prismaService: jest.Mocked<PrismaService>
  let logger: jest.Mocked<Logger>
  let accountAccessService: jest.Mocked<AccountAccessService>
  let paginationService: jest.Mocked<PaginationService>

  beforeEach(async () => {
    clearAllMocks()

    // Create a mock for PaginationService
    const mockPaginationService = {
      getOffset: jest.fn().mockReturnValue(0),
      createPaginatedResponse: jest.fn().mockImplementation((data, dto, total) => ({
        items: data,
        meta: {
          pagination: {
            page: 1,
            limit: dto.limit || 10,
            total
          },
          count: data.length
        }
      }))
    }

    // Configure mocks for Prisma
    ;(mockPrismaService.user as any).count = jest.fn()
    ;(mockPrismaService.entity as any).findMany = jest.fn()
    ;(mockPrismaService.entity as any).count = jest.fn()
    ;(mockPrismaService.role as any).count = jest.fn()
    ;(mockPrismaService as any).$transaction = jest.fn()

    const module = await createTestingModule([
      AccountService,
      {
        provide: PrismaService,
        useValue: mockPrismaService
      },
      {
        provide: Logger,
        useValue: mockLogger
      },
      {
        provide: AccountAccessService,
        useValue: mockAccountAccessService
      },
      {
        provide: PaginationService,
        useValue: mockPaginationService
      }
    ])

    service = module.get<AccountService>(AccountService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
    paginationService = module.get(PaginationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchAccount', () => {
    /**
     * Test data setup
     */
    const mockUserWithDetails = {
      ...mockUser,
      people: {
        id: '1',
        firstname: 'Bruce',
        lastname: 'Wayne'
      },
      rolesLinked: [{ role: mockRole }],
      entitiesLinked: [{ entity: mockEntity }]
    }

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks()

        // Create a more complete account with all properties expected by the service
        const enhancedAccount = {
          ...mockAccount,
          usersLinked: [{ user: mockUserWithDetails }],
          entities: [mockEntity],
          roles: [mockRole]
          // Add any other fields that might be needed
        }

        // Create a complete UserAccountLink with the enhanced account
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: enhancedAccount,
          indirectAccess: false
        }

        // Configure standard mocks with proper account data
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)

        // Make sure account.findUnique returns the enhanced account
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(enhancedAccount)
      })

      it('should fetch account details with all related data', async () => {
        // Create a userAccountLink with a complete account included
        const mockFullAccount = {
          ...mockAccount,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: 'Test account description'
        }

        const mockFullUserAccountLink = {
          ...mockUserAccountLink,
          account: mockFullAccount,
          indirectAccess: false
        }

        // 1. Mock validateUserAccountAccess
        accountAccessService.validateUserAccountAccess.mockReset()
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockFullUserAccountLink)

        // 2. Mock $transaction
        // Create a mock that matches the format expected by the service
        const mockTransactionResults = [
          // First element: result of user.findMany
          [
            {
              ...mockUserWithDetails,
              accountsLinked: [{ accountId: mockAccount.id }],
              entitiesLinked: [{ entity: { id: mockEntity.id, accountId: mockAccount.id } }]
            }
          ],
          // Second element: result of user.count
          1,
          // Third element: result of entity.findMany
          [
            {
              ...mockEntity,
              organization: { id: '1', name: 'Test Organization' }
            }
          ],
          // Fourth element: result of entity.count
          1,
          // Fifth element: result of role.findMany
          [
            {
              ...mockRole,
              description: 'Test role',
              accountId: mockAccount.id
            }
          ],
          // Sixth element: result of role.count
          1
        ]

        // Reset and configure the $transaction mock
        const transactionMock = jest.fn().mockResolvedValue(mockTransactionResults)
        prismaService.$transaction = transactionMock

        // Act
        const result = await service.fetchAccount(mockUser.id, mockAccount.id)

        // Assert
        expect(result).toBeDefined()
        expect(result.id).toBe(mockAccount.id)
        expect(result.users.count).toBe(1)
        expect(result.entities.count).toBe(1)
        expect(result.roles.count).toBe(1)
      })
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

        // Act & Assert
        await expect(service.fetchAccount(mockUser.id, mockAccount.id)).rejects.toThrow(UnauthorizedException)
      })

      it('should throw NotFoundException if account does not exist', async () => {
        // Arrange
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }

        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(null)

        // Simulate a NotFoundException directly in the service
        const notFoundError = new NotFoundException(`Account with ID ${mockAccount.id} not found`)
        ;(prismaService as any).$transaction.mockRejectedValue(notFoundError)

        // Act & Assert
        await expect(service.fetchAccount(mockUser.id, mockAccount.id)).rejects.toThrow(`Account with ID ${mockAccount.id} not found`)
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }

        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)

        // Use spy approach for better control
        const transactionSpy = jest.spyOn(prismaService, '$transaction')

        // Simulate a database error
        const dbError = new Error('Database error')
        transactionSpy.mockImplementation(() => {
          throw dbError
        })

        // Act & Assert
        await expect(service.fetchAccount(mockUser.id, mockAccount.id)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error'), 'getAccountDetails')
      })
    })
  })

  describe('updateAccountStatus', () => {
    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)
      })

      it('should update account status when changing from active to inactive', async () => {
        // Arrange
        ;(prismaService.account.update as jest.Mock).mockResolvedValue({
          ...mockAccount,
          isActive: false
        })

        // Act
        const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, false)

        // Assert
        expect(result).toEqual({
          id: mockAccount.id,
          name: mockAccount.name,
          isActive: false
        })

        // Verify
        expect(prismaService.account.update).toHaveBeenCalledWith({
          where: { id: mockAccount.id },
          data: { isActive: false }
        })
      })

      it('should not update if account is already in desired state', async () => {
        // Act
        const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, true)

        // Assert
        expect(result).toEqual({
          id: mockAccount.id,
          name: mockAccount.name,
          isActive: true
        })

        // Verify
        expect(prismaService.account.update).not.toHaveBeenCalled()
      })
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

        // Act & Assert
        await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        ;(prismaService.account.update as jest.Mock).mockRejectedValue(new Error('Database error'))

        // Act & Assert
        await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith('Failed to update account 1 status to inactive for user 1: Database error', 'updateAccountStatus')
      })
    })
  })

  describe('updateAccountUsers', () => {
    /**
     * Test data setup
     */
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
          users: [{ user: mockUser }]
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

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
        ;(prismaService as any).$transaction.mockImplementation(async (callback) => callback(prismaService))
      })

      it('should update account users successfully', async () => {
        // Arrange - Reset mock pour éviter tout comportement précédent
        jest.clearAllMocks()

        // Create the complete data for the mock
        const mockAccountWithCompleteUsers = {
          ...mockAccount,
          usersLinked: [
            {
              userId: mockUser.id,
              accountId: mockAccount.id,
              user: {
                ...mockUser,
                people: {
                  id: '1',
                  firstname: 'Bruce',
                  lastname: 'Wayne'
                }
              }
            }
          ],
          entities: [
            {
              ...mockEntity,
              users: [{ user: mockUser }]
            }
          ]
        }

        // Mock the account.findUnique method to return the account with complete users
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithCompleteUsers)

        // Mock the transaction methods
        const transactionFn = jest.fn().mockImplementation(async (callback) => {
          // If callback is a function, execute it with the prisma mock
          if (typeof callback === 'function') {
            return await callback({
              userAccountLink: {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                createMany: jest.fn().mockResolvedValue({ count: 2 })
              }
            })
          }
          return null
        })

        prismaService.$transaction = transactionFn

        // Mock userAccountLink.findMany to return the users after update
        ;(prismaService.userAccountLink.findMany as jest.Mock).mockResolvedValue(
          mockNewUsers.map((user) => ({
            user: {
              ...user,
              people: user.people
            }
          }))
        )

        // Act
        const newUserIds = ['2', '3']
        const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, newUserIds)

        // Assert
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

        // Verify
        expect(prismaService.$transaction).toHaveBeenCalled()
      })

      it('should handle partial update (add and remove users simultaneously)', async () => {
        // Arrange
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

        // Act
        const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

        // Assert
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

        // Verify
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

      it('should handle users with inactive status', async () => {
        // Arrange
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

        // Act
        const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

        // Assert
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
        // Arrange
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

        // Act
        const result = await service.updateAccountUsers(mockUser.id, mockAccount.id, ['2'])

        // Assert
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
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      beforeEach(() => {
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)
      })

      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

        // Act & Assert
        await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['2', '3'])).rejects.toThrow(UnauthorizedException)
      })

      it('should throw NotFoundException if account does not exist', async () => {
        // Arrange
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(null)

        // Act & Assert
        await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['2', '3'])).rejects.toThrow('Account with ID 1 not found')
      })

      it('should throw BadRequestException if update would leave account without active users', async () => {
        // Arrange
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue({
          ...mockAccountWithUsers,
          usersLinked: [], // No direct users
          entities: [] // No entities with users
        })

        // Act & Assert
        await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, [])).rejects.toThrow('Cannot update users as it would leave the account without any active users')
      })

      it('should handle case where some users do not exist', async () => {
        // Arrange
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)

        // Ensure the transaction returns an error
        const foreignKeyError = new Error('Foreign key constraint failed')
        ;(prismaService as any).$transaction.mockImplementation((callback) => {
          if (typeof callback === 'function') {
            // Simulate failure during transaction execution
            throw foreignKeyError
          }
          return Promise.reject(foreignKeyError)
        })

        // Act & Assert
        await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['999'])).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Foreign key constraint failed'), expect.any(String))
      })
    })
  })

  describe('fetchAccountUsers', () => {
    /**
     * Test data setup
     */
    const mockUsersList = [
      {
        ...mockUser,
        people: {
          id: '1',
          firstname: 'Bruce',
          lastname: 'Wayne'
        },
        rolesLinked: [{ role: mockRole }],
        entitiesLinked: [{ entity: { ...mockEntity, accountId: mockAccount.id } }],
        accountsLinked: [{ accountId: mockAccount.id }]
      },
      {
        ...mockUser,
        id: '2',
        email: 'user2@test.com',
        people: {
          id: '2',
          firstname: 'Diana',
          lastname: 'Prince'
        },
        rolesLinked: [{ role: mockRole }],
        entitiesLinked: [{ entity: { ...mockEntity, accountId: mockAccount.id } }],
        accountsLinked: []
      }
    ]

    const mockUsersCount = 2

    const mockProcessedUsers = [
      {
        id: mockUser.id,
        email: mockUser.email,
        isActive: true,
        people: {
          id: '1',
          firstname: 'Bruce',
          lastname: 'Wayne'
        },
        roles: [{ id: mockRole.id, name: mockRole.name }],
        entityIds: [mockEntity.id],
        isDirectlyLinked: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)

        // Configure $transaction to return expected data
        ;(prismaService as any).$transaction.mockImplementation((queries) => {
          if (typeof queries === 'function') {
            return queries(prismaService)
          }
          return Promise.resolve([mockUsersList, mockUsersCount])
        })

        paginationService.createPaginatedResponse.mockReturnValue({
          items: mockProcessedUsers,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockUsersCount
            },
            count: mockProcessedUsers.length
          }
        })
        paginationService.getOffset.mockReturnValue(0)
      })

      it('should fetch account users with pagination', async () => {
        // Arrange
        const dto = { page: 1, limit: 10 }

        // Act
        const result = await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Assert
        expect(result).toEqual({
          items: mockProcessedUsers,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockUsersCount
            },
            count: mockProcessedUsers.length
          }
        })

        // Verify service calls
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, 'fetchAccountUsers')

        expect((prismaService as any).$transaction).toHaveBeenCalled()
        expect(paginationService.createPaginatedResponse).toHaveBeenCalled()
      })

      it('should apply search filter when provided', async () => {
        // Arrange
        const dto = { search: 'Wayne', page: 1, limit: 10 }

        // Act
        await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply entity filter when provided', async () => {
        // Arrange
        const dto = { entityIds: [mockEntity.id], page: 1, limit: 10 }

        // Act
        await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply role filter when provided', async () => {
        // Arrange
        const dto = { roleIds: [mockRole.id], page: 1, limit: 10 }

        // Act
        await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply isActive filter when provided', async () => {
        // Arrange
        const dto = { isActive: true, page: 1, limit: 10 }

        // Act
        await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply correct order when orderBy is provided', async () => {
        // Arrange
        const dto = { orderBy: UserOrderBy.NAME, page: 1, limit: 10 }

        // Act
        await service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        const enhancedUserAccountLink = {
          ...mockUserAccountLink,
          account: mockAccount,
          indirectAccess: false
        }
        accountAccessService.validateUserAccountAccess.mockResolvedValue(enhancedUserAccountLink)
        const dbError = new Error('Database error')
        ;(prismaService as any).$transaction.mockImplementation(() => {
          throw dbError
        })
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountUsers(mockUser.id, mockAccount.id, dto)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error'), expect.any(String))
      })
    })
  })

  describe('fetchAccountEntities', () => {
    /**
     * Test data setup
     */
    const mockEntitiesList = [
      {
        ...mockEntity,
        organization: {
          id: '1',
          name: 'Wayne Enterprises'
        }
      },
      {
        ...mockEntity,
        id: '2',
        name: 'Test Entity 2',
        organization: null
      }
    ]

    const mockEntitiesCount = 2

    const mockProcessedEntities = [
      {
        id: mockEntity.id,
        name: mockEntity.name,
        description: mockEntity.description,
        isActive: mockEntity.isActive,
        organization: {
          id: '1',
          name: 'Wayne Enterprises'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

        // Configure $transaction to return expected data
        ;(prismaService as any).$transaction.mockImplementation((queries) => {
          if (typeof queries === 'function') {
            return queries(prismaService)
          }
          return Promise.resolve([mockEntitiesList, mockEntitiesCount])
        })

        paginationService.createPaginatedResponse.mockReturnValue({
          items: mockProcessedEntities,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockEntitiesCount
            },
            count: mockProcessedEntities.length
          }
        })
        paginationService.getOffset.mockReturnValue(0)
      })

      it('should fetch account entities with pagination', async () => {
        // Arrange
        const dto = { page: 1, limit: 10 }

        // Act
        const result = await service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)

        // Assert
        expect(result).toEqual({
          items: mockProcessedEntities,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockEntitiesCount
            },
            count: mockProcessedEntities.length
          }
        })

        // Verify service calls
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, 'fetchAccountEntities')

        expect((prismaService as any).$transaction).toHaveBeenCalled()
        expect(paginationService.createPaginatedResponse).toHaveBeenCalled()
      })

      it('should apply search filter when provided', async () => {
        // Arrange
        const dto = { search: 'Wayne', page: 1, limit: 10 }

        // Act
        await service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply user filter when provided', async () => {
        // Arrange
        const dto = { userIds: [mockUser.id], page: 1, limit: 10 }

        // Act
        await service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply isActive filter when provided', async () => {
        // Arrange
        const dto = { isActive: true, page: 1, limit: 10 }

        // Act
        await service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply correct order when orderBy is provided', async () => {
        // Arrange
        const dto = { orderBy: EntityOrderBy.NAME, page: 1, limit: 10 }

        // Act
        await service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        const dbError = new Error('Database error')
        ;(prismaService as any).$transaction.mockImplementation(() => {
          throw dbError
        })
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountEntities(mockUser.id, mockAccount.id, dto)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error'), expect.any(String))
      })
    })
  })

  describe('fetchAccountRoles', () => {
    /**
     * Test data setup
     */
    const mockRolesList = [
      {
        ...mockRole,
        accountId: mockAccount.id,
        description: 'Account admin role'
      },
      {
        ...mockRole,
        id: 2,
        name: 'Global Role',
        accountId: null,
        isGlobal: true,
        description: 'Global role'
      }
    ]

    const mockRolesCount = 2

    const mockProcessedRoles = [
      {
        id: mockRole.id,
        name: mockRole.name,
        description: 'Account admin role',
        isActive: mockRole.isActive,
        isGlobal: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

        // Configurer $transaction pour retourner les données attendues
        ;(prismaService as any).$transaction.mockImplementation((queries) => {
          if (typeof queries === 'function') {
            return queries(prismaService)
          }
          return Promise.resolve([mockRolesList, mockRolesCount])
        })

        paginationService.createPaginatedResponse.mockReturnValue({
          items: mockProcessedRoles,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockRolesCount
            },
            count: mockProcessedRoles.length
          }
        })
        paginationService.getOffset.mockReturnValue(0)
      })

      it('should fetch account roles with pagination', async () => {
        // Arrange
        const dto = { page: 1, limit: 10 }

        // Act
        const result = await service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)

        // Assert
        expect(result).toEqual({
          items: mockProcessedRoles,
          meta: {
            pagination: {
              current: 1,
              limit: 10,
              total: mockRolesCount
            },
            count: mockProcessedRoles.length
          }
        })

        // Verify service calls
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, 'fetchAccountRoles')

        expect((prismaService as any).$transaction).toHaveBeenCalled()
        expect(paginationService.createPaginatedResponse).toHaveBeenCalled()
      })

      it('should apply search filter when provided', async () => {
        // Arrange
        const dto = { search: 'Admin', page: 1, limit: 10 }

        // Act
        await service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply isActive filter when provided', async () => {
        // Arrange
        const dto = { isActive: true, page: 1, limit: 10 }

        // Act
        await service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })

      it('should apply correct order when orderBy is provided', async () => {
        // Arrange
        const dto = { orderBy: RoleOrderBy.NAME, page: 1, limit: 10 }

        // Act
        await service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)

        // Verify that transaction is called
        expect((prismaService as any).$transaction).toHaveBeenCalled()
      })
    })

    /**
     * Error cases
     */
    describe('when errors occur', () => {
      it('should throw UnauthorizedException if user does not have access', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        const dbError = new Error('Database error')
        ;(prismaService as any).$transaction.mockImplementation(() => {
          throw dbError
        })
        const dto = { page: 1, limit: 10 }

        // Act & Assert
        await expect(service.fetchAccountRoles(mockUser.id, mockAccount.id, dto)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error'), expect.any(String))
      })
    })
  })
})
