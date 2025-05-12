/**
 * Unit tests for AccountService
 */
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
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

  beforeEach(async () => {
    clearAllMocks()

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
      }
    ])

    service = module.get<AccountService>(AccountService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchAccountDeep', () => {
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

    const mockAccountWithDetails = {
      ...mockAccount,
      usersLinked: [{ user: mockUserWithDetails }],
      entities: [mockEntity],
      roles: [mockRole]
    }

    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithDetails)
        ;(prismaService.role.findMany as jest.Mock).mockResolvedValue([])
      })

      it('should fetch account details with all related data', async () => {
        // Act
        const result = await service.fetchAccountDeep(mockUser.id, mockAccount.id)

        // Assert
        expect(result).toEqual(
          expect.objectContaining({
            id: mockAccount.id,
            name: mockAccount.name,
            description: mockAccount.description,
            isActive: mockAccount.isActive,
            users: expect.arrayContaining([
              expect.objectContaining({
                id: mockUser.id,
                email: mockUser.email,
                isActive: mockUser.isActive,
                roles: expect.arrayContaining([
                  expect.objectContaining({
                    id: 1,
                    name: 'Admin'
                  })
                ]),
                entityIds: expect.arrayContaining([mockEntity.id])
              })
            ]),
            entities: expect.arrayContaining([
              expect.objectContaining({
                id: mockEntity.id,
                name: mockEntity.name,
                description: mockEntity.description,
                isActive: mockEntity.isActive
              })
            ]),
            roles: expect.arrayContaining([
              expect.objectContaining({
                id: mockRole.id,
                name: mockRole.name,
                isActive: mockRole.isActive,
                isGlobal: false
              })
            ])
          })
        )

        // Verify service calls
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, 'getAccountDetails')
        expect(prismaService.account.findUnique).toHaveBeenCalledWith({
          where: { id: mockAccount.id },
          include: expect.any(Object)
        })
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
        await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow(UnauthorizedException)
      })

      it('should throw NotFoundException if account does not exist', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(null)

        // Act & Assert
        await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow('Account with ID 1 not found')
      })

      it('should handle database errors gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

        // Act & Assert
        await expect(service.fetchAccountDeep(mockUser.id, mockAccount.id)).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith('Failed to get account details: Database error', 'getAccountDetails')
      })
    })
  })

  describe('updateAccountStatus', () => {
    /**
     * Success cases
     */
    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
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
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        ;(prismaService.account.findUnique as jest.Mock).mockResolvedValue(mockAccountWithUsers)
        ;(prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prismaService))
      })

      it('should update account users successfully', async () => {
        // Arrange
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
        expect(prismaService.userAccountLink.deleteMany).toHaveBeenCalled()
        expect(prismaService.userAccountLink.createMany).toHaveBeenCalled()
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
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
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
        ;(prismaService.userAccountLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
        ;(prismaService.userAccountLink.createMany as jest.Mock).mockRejectedValue(new Error('Foreign key constraint failed'))

        // Act & Assert
        await expect(service.updateAccountUsers(mockUser.id, mockAccount.id, ['999'])).rejects.toThrow(BadRequestException)

        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith('Failed to manage users for account 1: Foreign key constraint failed', 'manageAccountUsers')
      })
    })
  })
})
