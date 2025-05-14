// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Unit tests for ExpiredInvitationsSchedulerService
 */
import { Test, TestingModule } from '@nestjs/testing'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { ExpiredInvitationsSchedulerService } from '@modules/invitation/services/expired-invitations-scheduler.service'

/**
 * Test utilities and mocks
 */
import { mockLogger, mockPrismaService } from '@common/tests/unit/mocks/service-mocks'
import { clearAllMocks } from '@common/tests/unit/utils/test-utils'

/**
 * Test suite
 */
describe('ExpiredInvitationsSchedulerService', () => {
  let service: ExpiredInvitationsSchedulerService
  let prismaService: jest.Mocked<PrismaService>
  let logger: jest.Mocked<Logger>

  beforeEach(async () => {
    clearAllMocks()

    // Mock the necessary Prisma methods
    mockPrismaService.userToken = {
      findMany: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn()
    }

    mockPrismaService.invitation = {
      findFirst: jest.fn(),
      update: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpiredInvitationsSchedulerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: Logger,
          useValue: mockLogger
        }
      ]
    }).compile()

    service = module.get<ExpiredInvitationsSchedulerService>(ExpiredInvitationsSchedulerService)
    prismaService = module.get(PrismaService)
    logger = module.get(Logger)
  })

  describe('handleExpiredInvitations', () => {
    const mockExpiredTokens = [
      {
        id: '1',
        userId: 'user-1',
        token: 'expired-token-1',
        user: {
          email: 'expired1@test.com'
        }
      },
      {
        id: '2',
        userId: 'user-2',
        token: 'expired-token-2',
        user: {
          email: 'expired2@test.com'
        }
      }
    ]

    it('should mark expired invitations and delete expired tokens', async () => {
      // Arrange
      prismaService.userToken.findMany.mockResolvedValue(mockExpiredTokens)

      // Mock invitation for first token
      prismaService.invitation.findFirst
        .mockResolvedValueOnce({ id: 'invitation-1', status: 'SENT' })
        // Mock invitation for second token
        .mockResolvedValueOnce({ id: 'invitation-2', status: 'SENT' })

      // Act
      await service.handleExpiredInvitations()

      // Assert
      // Verify that it found all expired tokens
      expect(prismaService.userToken.findMany).toHaveBeenCalledWith({
        where: {
          type: 'INVITATION',
          expiresAt: {
            lt: expect.any(Date)
          }
        },
        select: expect.any(Object)
      })

      // Verify that it processed each token
      expect(prismaService.invitation.findFirst).toHaveBeenCalledTimes(2)
      expect(prismaService.invitation.update).toHaveBeenCalledTimes(2)
      expect(prismaService.userToken.delete).toHaveBeenCalledTimes(2)

      // Verify specific calls for the first invitation
      expect(prismaService.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          inviteeUserEmail: 'expired1@test.com',
          status: 'SENT'
        }
      })
      expect(prismaService.invitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-1' },
        data: { status: 'EXPIRED' }
      })
      expect(prismaService.userToken.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      })

      // Verify log messages
      expect(logger.debug).toHaveBeenCalledWith('Checking for expired invitations...', 'ExpiredInvitationsSchedulerService')
      expect(logger.debug).toHaveBeenCalledWith('Found 2 expired invitation tokens', 'ExpiredInvitationsSchedulerService')
      expect(logger.debug).toHaveBeenCalledWith('Finished checking for expired invitations', 'ExpiredInvitationsSchedulerService')
    })

    it('should skip invitations that are not found', async () => {
      // Arrange
      prismaService.userToken.findMany.mockResolvedValue([mockExpiredTokens[0]])
      // No invitation found for this token
      prismaService.invitation.findFirst.mockResolvedValue(null)

      // Act
      await service.handleExpiredInvitations()

      // Assert
      // Invitation update and token delete should not be called
      expect(prismaService.invitation.update).not.toHaveBeenCalled()
      expect(prismaService.userToken.delete).not.toHaveBeenCalled()
    })

    it('should handle no expired tokens gracefully', async () => {
      // Arrange
      prismaService.userToken.findMany.mockResolvedValue([])

      // Act
      await service.handleExpiredInvitations()

      // Assert
      expect(prismaService.invitation.findFirst).not.toHaveBeenCalled()
      expect(prismaService.invitation.update).not.toHaveBeenCalled()
      expect(prismaService.userToken.delete).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('Found 0 expired invitation tokens', 'ExpiredInvitationsSchedulerService')
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      prismaService.userToken.findMany.mockRejectedValue(new Error('Database connection error'))

      // Act
      await service.handleExpiredInvitations()

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error checking for expired invitations: Database connection error', 'ExpiredInvitationsSchedulerService')
    })
  })
})
