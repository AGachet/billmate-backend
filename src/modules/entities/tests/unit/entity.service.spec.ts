// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Unit tests for EntityService
 */
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { EntityService } from '@modules/entities/services/entity.service'

/**
 * Test utilities and mocks
 */
import { mockAccountAccessService, mockLogger, mockPrismaService } from '@common/tests/unit/mocks/service-mocks'
import { mockAccount, mockEntity, mockOrganization, mockUser, mockUserAccountLink } from '@common/tests/unit/mocks/test-data'
import { clearAllMocks, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Test suite
 */
describe('EntityService', () => {
  let service: EntityService
  let prismaService: jest.Mocked<PrismaService>
  let logger: jest.Mocked<Logger>
  let accountAccessService: jest.Mocked<AccountAccessService>

  beforeEach(async () => {
    clearAllMocks()

    const module = await createTestingModule([
      EntityService,
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

    service = module.get<EntityService>(EntityService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
  })

  describe('createEntity', () => {
    const createEntityDto = {
      name: 'Test Entity',
      description: 'Test Entity Description',
      accountId: mockAccount.id,
      organizationId: mockOrganization.id
    }

    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.organization.findUnique.mockResolvedValue(mockOrganization)
        prismaService.entity.create.mockResolvedValue(mockEntity)
      })

      it('should create an entity successfully', async () => {
        // Act
        const result = await service.createEntity(mockUser.id, createEntityDto)

        // Assert
        expect(result).toEqual(
          expect.objectContaining({
            id: mockEntity.id,
            name: mockEntity.name,
            isActive: mockEntity.isActive,
            description: mockEntity.description,
            organization: expect.objectContaining({
              id: mockOrganization.id,
              name: mockOrganization.name
            })
          })
        )

        // Verify
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, expect.any(String))
        expect(prismaService.organization.findUnique).toHaveBeenCalledWith({
          where: { id: mockOrganization.id }
        })
        expect(prismaService.entity.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: createEntityDto.name,
            description: createEntityDto.description,
            accountId: createEntityDto.accountId,
            organizationId: createEntityDto.organizationId
          })
        })
      })
    })

    describe('when errors occur', () => {
      it('should throw NotFoundException if organization does not exist', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.organization.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(NotFoundException)
      })

      it('should throw UnauthorizedException if user does not have access to account', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
        prismaService.organization.findUnique.mockResolvedValue(mockOrganization)

        // Act & Assert
        await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database error gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.organization.findUnique.mockResolvedValue(mockOrganization)
        prismaService.entity.create.mockRejectedValue(new Error('Database error'))

        // Act & Assert
        await expect(service.createEntity(mockUser.id, createEntityDto)).rejects.toThrow(BadRequestException)

        // Verify
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create entity'), 'createEntity')
      })
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

    describe('when successful', () => {
      beforeEach(() => {
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.entity.findUnique.mockResolvedValue(mockEntityWithUsers)
        prismaService.userEntityLink.deleteMany.mockResolvedValue({ count: 1 })
        prismaService.userEntityLink.createMany.mockResolvedValue({ count: 1 })
        prismaService.userEntityLink.findMany.mockResolvedValue([
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
        prismaService.userAccountLink.findMany.mockResolvedValue([
          {
            userId: '2',
            accountId: mockAccount.id
          }
        ])
      })

      it('should update entity users successfully', async () => {
        // Act
        const result = await service.updateEntityUsers(mockUser.id, mockEntity.id, ['2'])

        // Assert
        expect(result).toEqual({
          id: mockEntity.id,
          name: mockEntity.name,
          users: [
            expect.objectContaining({
              id: '2',
              email: 'user2@test.com',
              firstname: 'Jane',
              lastname: 'Smith',
              isActive: true
            })
          ]
        })

        // Verify
        expect(accountAccessService.validateUserAccountAccess).toHaveBeenCalledWith(mockUser.id, mockAccount.id, expect.any(String))
        expect(prismaService.userEntityLink.deleteMany).toHaveBeenCalled()
        expect(prismaService.userEntityLink.createMany).toHaveBeenCalled()
      })
    })

    describe('when errors occur', () => {
      it('should throw NotFoundException if entity does not exist', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.entity.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(service.updateEntityUsers(mockUser.id, 'non-existent-id', ['2'])).rejects.toThrow(NotFoundException)
      })

      it('should throw UnauthorizedException if user does not have access to account', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())
        prismaService.entity.findUnique.mockResolvedValue(mockEntityWithUsers)

        // Act & Assert
        await expect(service.updateEntityUsers(mockUser.id, mockEntity.id, ['2'])).rejects.toThrow(UnauthorizedException)
      })

      it('should throw BadRequestException if removing all users would leave account without active users', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.entity.findUnique.mockResolvedValue(mockEntityWithUsers)
        prismaService.userAccountLink.findMany.mockResolvedValue([])
        prismaService.userEntityLink.findMany.mockResolvedValue([])

        // Act & Assert
        await expect(service.updateEntityUsers(mockUser.id, mockEntity.id, [])).rejects.toThrow(BadRequestException)
      })

      it('should handle database error gracefully', async () => {
        // Arrange
        accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
        prismaService.entity.findUnique.mockResolvedValue(mockEntityWithUsers)

        // Ces mocks sont nécessaires pour éviter l'erreur de validation
        prismaService.userAccountLink.findMany.mockResolvedValue([{ userId: '3', accountId: mockAccount.id }])
        prismaService.userEntityLink.findMany.mockResolvedValue([{ userId: '3', entityId: 'other-entity' }])

        // Reset les mocks
        logger.error.mockClear()

        // Mock transaction to throw error
        prismaService.$transaction.mockImplementationOnce(() => {
          throw new Error('Database error')
        })

        // Act & Assert
        try {
          await service.updateEntityUsers(mockUser.id, mockEntity.id, [])
          fail('Should have thrown an error')
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException)
          expect(error.message).toBe('Failed to update entity users')
          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Failed to manage users for entity ${mockEntity.id}`), 'updateEntityUsers')
        }
      })
    })
  })
})
