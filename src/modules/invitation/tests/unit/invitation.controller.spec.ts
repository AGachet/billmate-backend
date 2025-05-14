// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Unit tests for InvitationController
 */
import { Test, TestingModule } from '@nestjs/testing'
import { Locale } from '@prisma/client'

/**
 * Dependencies
 */
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '@modules/auth/guards/permissions.guard'
import { InvitationController } from '@modules/invitation/controllers/invitation.controller'
import { InvitationService } from '@modules/invitation/services/invitation.service'

/**
 * DTO
 */
import { AcceptInvitationDto } from '@modules/invitation/dto/requests/accept-invitation.dto'
import { CreateInvitationDto } from '@modules/invitation/dto/requests/create-invitation.dto'

/**
 * Test utilities and mocks
 */
import { mockUser } from '@common/tests/unit/mocks/test-data'
import { clearAllMocks } from '@common/tests/unit/utils/test-utils'

/**
 * Test suite
 */
describe('InvitationController', () => {
  let controller: InvitationController
  let invitationService: jest.Mocked<InvitationService>

  // Mock authenticated request
  const mockRequest = {
    user: mockUser
  }

  beforeEach(async () => {
    clearAllMocks()

    // Create mock for InvitationService
    const mockInvitationService = {
      createInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
      getUserInvitations: jest.fn()
    }

    // No need to include JwtAuthGuard or PermissionsGuard for unit tests
    // We are simply testing that the controller calls the correct methods of the service
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: mockInvitationService
        }
      ]
    })
      // Override guards to avoid dependency errors
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<InvitationController>(InvitationController)
    invitationService = module.get(InvitationService)
  })

  describe('createInvitation', () => {
    it('should call invitationService.createInvitation with correct parameters', async () => {
      // Arrange
      const dto: CreateInvitationDto = {
        email: 'test@example.com',
        firstname: 'Test',
        lastname: 'User',
        roleIds: [1],
        accountIds: ['account-id'],
        entityIds: ['entity-id'],
        locale: Locale.FR
      }

      const expectedResponse = {
        message: 'Invitation sent successfully',
        invitationToken: 'token'
      }

      invitationService.createInvitation.mockResolvedValue(expectedResponse)

      // Act
      const result = await controller.createInvitation(mockRequest, dto)

      // Assert
      expect(invitationService.createInvitation).toHaveBeenCalledWith(mockUser.id, dto)
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('acceptInvitation', () => {
    it('should call invitationService.acceptInvitation with correct parameters', async () => {
      // Arrange
      const dto: AcceptInvitationDto = {
        invitationToken: 'test.invitation.token',
        password: 'SecurePassword123',
        firstname: 'Test',
        lastname: 'User',
        locale: Locale.FR
      }

      const serviceResponse = {
        userId: 'user-id',
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      }

      invitationService.acceptInvitation.mockResolvedValue(serviceResponse)

      // Act
      const result = await controller.acceptInvitation(dto)

      // Assert
      expect(invitationService.acceptInvitation).toHaveBeenCalledWith(dto)
      expect(result).toEqual({ userId: serviceResponse.userId })
    })
  })

  describe('getUserInvitations', () => {
    it('should call invitationService.getUserInvitations with correct user ID', async () => {
      // Arrange
      const mockInvitations = {
        invitations: [
          {
            id: '1',
            inviterUserId: mockUser.id,
            inviteeUserEmail: 'invited1@test.com',
            status: 'SENT',
            invitedAt: new Date(),
            accounts: [{ id: 'account-1', name: 'Account 1' }],
            entities: [{ id: 'entity-1', name: 'Entity 1' }],
            roles: [{ id: 1, name: 'User' }]
          }
        ]
      }

      invitationService.getUserInvitations.mockResolvedValue(mockInvitations)

      // Act
      const result = await controller.getUserInvitations(mockRequest)

      // Assert
      expect(invitationService.getUserInvitations).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockInvitations)
    })

    it('should return empty invitations array when user has no invitations', async () => {
      // Arrange
      const emptyInvitations = { invitations: [] }
      invitationService.getUserInvitations.mockResolvedValue(emptyInvitations)

      // Act
      const result = await controller.getUserInvitations(mockRequest)

      // Assert
      expect(invitationService.getUserInvitations).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(emptyInvitations)
    })
  })
})
