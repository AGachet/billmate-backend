/**
 * Resources
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { mockChalk, mockWinston } from '@configs/test/unit-mocks-glob'
import { AccountService } from '@modules/accounts/services/account.service'

/**
 * Mocks
 */
jest.mock('@common/services/logger/logger.service')
jest.mock('@configs/prisma/services/prisma.service')

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
  account: mockAccount
}

/**
 * Declaration
 */
describe('AccountService', () => {
  let service: AccountService
  let prismaService: jest.Mocked<PrismaService>
  let logger: jest.Mocked<Logger>

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
              findUnique: jest.fn()
            }
          }
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<AccountService>(AccountService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('updateAccountStatus', () => {
    it('should update account status successfully', async () => {
      // Mock prisma responses
      ;(prismaService.userAccountLink.findUnique as jest.Mock).mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.update as jest.Mock).mockResolvedValue({
        ...mockAccount,
        isActive: false
      })

      const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, false)

      expect(result).toEqual({
        ...mockAccount,
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
      ;(prismaService.userAccountLink.findUnique as jest.Mock).mockResolvedValue(mockUserAccountLink)

      const result = await service.updateAccountStatus(mockUser.id, mockAccount.id, true)

      expect(result).toEqual(mockAccount)
      expect(prismaService.account.update).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(`Account ${mockAccount.id} is already active`, 'updateAccountStatus')
    })

    it('should throw UnauthorizedException if user does not have access to account', async () => {
      // Mock prisma responses
      ;(prismaService.userAccountLink.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(UnauthorizedException)
      expect(logger.warn).toHaveBeenCalledWith(`User ${mockUser.id} tried to access unauthorized account ${mockAccount.id}`, 'updateAccountStatus')
    })

    it('should handle database error gracefully', async () => {
      // Mock user has access but update fails
      ;(prismaService.userAccountLink.findUnique as jest.Mock).mockResolvedValue(mockUserAccountLink)
      ;(prismaService.account.update as jest.Mock).mockRejectedValue(new Error('Database error'))

      await expect(service.updateAccountStatus(mockUser.id, mockAccount.id, false)).rejects.toThrow(BadRequestException)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update account'), 'updateAccountStatus')
    })
  })
})
