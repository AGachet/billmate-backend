/**
 * Resources
 */
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { OrganizationType } from '@prisma/client'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { mockChalk, mockWinston } from '@configs/test/unit-mocks-glob'
import { OrganizationService } from '@modules/organizations/services/organization.service'

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
  type: OrganizationType.COMPANY,
  description: 'Test Organization Description',
  website: 'https://test-org.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  accountsLinked: [{ accountId: '1' }]
}

const mockUserAccountLink = {
  userId: mockUser.id,
  accountId: mockAccount.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: mockAccount,
  indirectAccess: false
}

const mockOrganizationAccountLink = {
  organizationId: mockOrganization.id,
  accountId: mockAccount.id,
  createdAt: new Date(),
  updatedAt: new Date()
}

/**
 * Declaration
 */
describe('OrganizationService', () => {
  let service: OrganizationService
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
        OrganizationService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn()
            },
            organizationAccountLink: {
              create: jest.fn()
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

    service = module.get<OrganizationService>(OrganizationService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
    accountAccessService = module.get(AccountAccessService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchOrganization', () => {
    it('should fetch an organization successfully', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

      const result = await service.fetchOrganization(mockUser.id, mockOrganization.id)

      expect(result).toEqual({
        id: mockOrganization.id,
        name: mockOrganization.name,
        type: mockOrganization.type,
        description: mockOrganization.description,
        website: mockOrganization.website,
        createdAt: mockOrganization.createdAt,
        updatedAt: mockOrganization.updatedAt
      })
    })

    it('should throw NotFoundException if organization does not exist', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.fetchOrganization(mockUser.id, 'non-existent-id')).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException if organization is not linked to any account', async () => {
      // Mock an organization without linked accounts
      const organizationWithoutAccount = { ...mockOrganization, accountsLinked: [] }
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(organizationWithoutAccount)

      await expect(service.fetchOrganization(mockUser.id, mockOrganization.id)).rejects.toThrow(NotFoundException)
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      await expect(service.fetchOrganization(mockUser.id, mockOrganization.id)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.fetchOrganization(mockUser.id, mockOrganization.id)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get organization'), 'fetchOrganization')
    })
  })

  describe('createOrganization', () => {
    it('should create an organization successfully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.create as jest.Mock).mockResolvedValue(mockOrganization)
      ;(prismaService.organizationAccountLink.create as jest.Mock).mockResolvedValue(mockOrganizationAccountLink)

      const createOrganizationDto = {
        name: 'Test Organization',
        type: OrganizationType.COMPANY,
        description: 'Test Organization Description',
        website: 'https://test-org.com',
        accountId: mockAccount.id
      }

      const result = await service.createOrganization(mockUser.id, createOrganizationDto)

      expect(result).toEqual({
        id: mockOrganization.id,
        name: mockOrganization.name,
        type: mockOrganization.type,
        description: mockOrganization.description,
        website: mockOrganization.website,
        createdAt: mockOrganization.createdAt,
        updatedAt: mockOrganization.updatedAt
      })
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      const createOrganizationDto = {
        name: 'Test Organization',
        type: OrganizationType.COMPANY,
        description: 'Test Organization Description',
        website: 'https://test-org.com',
        accountId: mockAccount.id
      }

      await expect(service.createOrganization(mockUser.id, createOrganizationDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      // Mock prisma responses
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.create as jest.Mock).mockRejectedValue(new Error('Database error'))

      const createOrganizationDto = {
        name: 'Test Organization',
        type: OrganizationType.COMPANY,
        description: 'Test Organization Description',
        website: 'https://test-org.com',
        accountId: mockAccount.id
      }

      await expect(service.createOrganization(mockUser.id, createOrganizationDto)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create organization'), 'createOrganization')
    })
  })

  describe('updateOrganization', () => {
    it('should update an organization successfully', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

      const updatedOrganization = {
        ...mockOrganization,
        name: 'Updated Organization Name',
        description: 'Updated Organization Description'
      }

      ;(prismaService.organization.update as jest.Mock).mockResolvedValue(updatedOrganization)

      const updateOrganizationDto = {
        name: 'Updated Organization Name',
        description: 'Updated Organization Description'
      }

      const result = await service.updateOrganization(mockUser.id, mockOrganization.id, updateOrganizationDto)

      expect(result).toEqual({
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        type: updatedOrganization.type,
        description: updatedOrganization.description,
        website: updatedOrganization.website,
        createdAt: updatedOrganization.createdAt,
        updatedAt: updatedOrganization.updatedAt
      })
    })

    it('should return current organization if no fields to update', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)

      const updateOrganizationDto = {}

      const result = await service.updateOrganization(mockUser.id, mockOrganization.id, updateOrganizationDto)

      expect(result).toEqual({
        id: mockOrganization.id,
        name: mockOrganization.name,
        type: mockOrganization.type,
        description: mockOrganization.description,
        website: mockOrganization.website,
        createdAt: mockOrganization.createdAt,
        updatedAt: mockOrganization.updatedAt
      })

      // Verify that update was not called
      expect(prismaService.organization.update).not.toHaveBeenCalled()
    })

    it('should throw NotFoundException if organization does not exist', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(null)

      const updateOrganizationDto = {
        name: 'Updated Organization Name'
      }

      await expect(service.updateOrganization(mockUser.id, 'non-existent-id', updateOrganizationDto)).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException if organization is not linked to any account', async () => {
      // Mock an organization without linked accounts
      const organizationWithoutAccount = { ...mockOrganization, accountsLinked: [] }
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(organizationWithoutAccount)

      const updateOrganizationDto = {
        name: 'Updated Organization Name'
      }

      await expect(service.updateOrganization(mockUser.id, mockOrganization.id, updateOrganizationDto)).rejects.toThrow(NotFoundException)
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockRejectedValue(new UnauthorizedException())

      const updateOrganizationDto = {
        name: 'Updated Organization Name'
      }

      await expect(service.updateOrganization(mockUser.id, mockOrganization.id, updateOrganizationDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database error gracefully', async () => {
      // Mock prisma responses
      ;(prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization)
      accountAccessService.validateUserAccountAccess.mockResolvedValue(mockUserAccountLink)
      ;(prismaService.organization.update as jest.Mock).mockRejectedValue(new Error('Database error'))

      const updateOrganizationDto = {
        name: 'Updated Organization Name'
      }

      await expect(service.updateOrganization(mockUser.id, mockOrganization.id, updateOrganizationDto)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update organization'), 'updateOrganization')
    })
  })
})
