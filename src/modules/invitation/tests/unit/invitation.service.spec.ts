// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Unit tests for InvitationService
 */
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Locale, TokenType } from '@prisma/client'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { EnvConfig } from '@configs/env/services/env.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { AuthService } from '@modules/auth/services/auth.service'
import { EmailService } from '@modules/email/services/email.service'
import { InvitationService } from '@modules/invitation/services/invitation.service'

/**
 * Test utilities and mocks
 */
import { mockAccountAccessService, mockAuthService, mockEmailService, mockEnvConfig, mockJwtService, mockLogger, mockPrismaService } from '@common/tests/unit/mocks/service-mocks'
import { mockAccount, mockEntity, mockUser } from '@common/tests/unit/mocks/test-data'
import { clearAllMocks, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Test suite
 */
describe('InvitationService', () => {
  let service: InvitationService
  let prismaService: jest.Mocked<PrismaService>
  let jwtService: jest.Mocked<JwtService>
  let logger: jest.Mocked<Logger>
  let envConfig: jest.Mocked<EnvConfig>
  let authService: jest.Mocked<AuthService>

  beforeEach(async () => {
    clearAllMocks()

    // Use the mocks we've already defined in service-mocks.ts
    const mockInvitationToken = 'mock.invitation.token'
    mockJwtService.sign.mockReturnValue(mockInvitationToken)

    // Ensure userToken is properly mocked
    mockPrismaService.userToken = {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    }

    // Mock invitation methods
    mockPrismaService.invitation = {
      create: jest.fn().mockResolvedValue({ id: 'mock-invitation-id' }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }

    // Mock invitation links
    mockPrismaService.invitationAccountLink = {
      createMany: jest.fn()
    }

    mockPrismaService.invitationEntityLink = {
      createMany: jest.fn()
    }

    mockPrismaService.invitationRoleLink = {
      createMany: jest.fn()
    }

    // Ensure all necessary Prisma methods are mocked
    mockPrismaService.user = {
      ...(mockPrismaService.user || {}),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }

    // Mock the transaction function with proper implementation
    mockPrismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        const tx = {
          ...mockPrismaService,
          invitation: {
            ...mockPrismaService.invitation,
            updateMany: jest.fn().mockResolvedValue({ count: 1 })
          }
        }
        return await callback(tx)
      }
      return Promise.resolve(callback)
    })

    const module = await createTestingModule([
      InvitationService,
      {
        provide: PrismaService,
        useValue: mockPrismaService
      },
      {
        provide: JwtService,
        useValue: mockJwtService
      },
      {
        provide: Logger,
        useValue: mockLogger
      },
      {
        provide: EnvConfig,
        useValue: mockEnvConfig
      },
      {
        provide: EmailService,
        useValue: mockEmailService
      },
      {
        provide: AuthService,
        useValue: mockAuthService
      },
      {
        provide: AccountAccessService,
        useValue: mockAccountAccessService
      }
    ])

    service = module.get<InvitationService>(InvitationService)
    prismaService = module.get(PrismaService)
    jwtService = module.get(JwtService)
    logger = module.get(Logger)
    envConfig = module.get(EnvConfig)
    authService = module.get(AuthService)
  })

  describe('createInvitation', () => {
    const createInvitationDto = {
      email: 'invited@test.com',
      firstname: 'Invited',
      lastname: 'User',
      roleIds: [1],
      accountIds: [mockAccount.id],
      entityIds: [mockEntity.id],
      locale: Locale.FR
    }

    const mockInviter = {
      ...mockUser,
      people: {
        id: '1',
        firstname: 'Inviter',
        lastname: 'Admin'
      },
      rolesLinked: [
        {
          role: {
            permissionsLinked: [
              {
                permission: { name: 'USER_ACCOUNTS_INVITATION' }
              },
              {
                permission: { name: 'USER_ENTITIES_INVITATION' }
              },
              {
                permission: { name: 'USER_ROLE_ALLOCATION' }
              }
            ]
          }
        }
      ],
      accountsLinked: [
        {
          account: {
            id: mockAccount.id,
            isActive: true,
            entities: [
              {
                id: mockEntity.id,
                accountId: mockAccount.id,
                isActive: true
              }
            ]
          }
        }
      ],
      entitiesLinked: []
    }

    const mockInvitationToken = 'mock.invitation.token'
    const mockUserTokenRecord = {
      id: '1',
      userId: '2',
      token: mockInvitationToken,
      type: TokenType.INVITATION,
      expiresAt: new Date(Date.now() + 86400000)
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.user.findUnique
          .mockResolvedValueOnce(mockInviter) // For inviter
          .mockResolvedValueOnce(null) // For existing user check
        prismaService.user.create.mockResolvedValue({
          id: '2',
          email: createInvitationDto.email,
          isActive: false,
          password: ''
        })
        prismaService.userToken.create.mockResolvedValue(mockUserTokenRecord)
        prismaService.invitation.create.mockResolvedValue({ id: 'mock-invitation-id' })
        prismaService.invitationAccountLink.createMany.mockResolvedValue({ count: 1 })
        prismaService.invitationEntityLink.createMany.mockResolvedValue({ count: 1 })
        prismaService.invitationRoleLink.createMany.mockResolvedValue({ count: 1 })

        jwtService.sign.mockReturnValue(mockInvitationToken)
        envConfig.get.mockImplementation((key) => {
          const values = {
            JWT_SECRET_INVITATION: 'test-secret',
            JWT_INVITATION_EXPIRES_IN: '1d',
            NODE_ENV: 'test'
          }
          return values[key]
        })
        authService.createUniqueToken.mockResolvedValue(mockUserTokenRecord)
      })

      it('should create an invitation successfully', async () => {
        // Act
        const result = await service.createInvitation(mockUser.id, createInvitationDto)

        // Assert
        expect(result).toEqual({
          message: expect.any(String),
          invitationToken: mockInvitationToken
        })

        // Verify
        expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2)
        expect(jwtService.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            email: createInvitationDto.email,
            sub: expect.any(String),
            firstname: createInvitationDto.firstname,
            lastname: createInvitationDto.lastname,
            locale: createInvitationDto.locale
          }),
          expect.any(Object)
        )
        expect(authService.createUniqueToken).toHaveBeenCalledWith(expect.any(String), mockInvitationToken, TokenType.INVITATION, '1d')

        // Verify that the invitation is created with the correct links
        expect(prismaService.invitation.create).toHaveBeenCalled()
        expect(prismaService.invitationAccountLink.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              invitationId: 'mock-invitation-id',
              accountId: mockAccount.id
            })
          ])
        })
        expect(prismaService.invitationEntityLink.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              invitationId: 'mock-invitation-id',
              entityId: mockEntity.id
            })
          ])
        })
        expect(prismaService.invitationRoleLink.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              invitationId: 'mock-invitation-id',
              roleId: 1
            })
          ])
        })
      })

      it('should reuse existing inactive user', async () => {
        // Arrange
        const existingInactiveUser = {
          id: '2',
          email: createInvitationDto.email,
          isActive: false,
          password: ''
        }
        prismaService.user.findUnique.mockReset()
        prismaService.user.findUnique
          .mockResolvedValueOnce(mockInviter) // For inviter
          .mockResolvedValueOnce(existingInactiveUser) // For existing user check

        // Act
        const result = await service.createInvitation(mockUser.id, createInvitationDto)

        // Assert
        expect(result).toEqual({
          message: expect.any(String),
          invitationToken: mockInvitationToken
        })

        // Verify - should not create a new user
        expect(prismaService.user.create).not.toHaveBeenCalled()
      })

      it('should not create new user for existing active user', async () => {
        // Arrange
        const existingActiveUser = {
          id: '2',
          email: createInvitationDto.email,
          isActive: true,
          password: 'hashed-password'
        }
        prismaService.user.findUnique.mockReset()
        prismaService.user.findUnique
          .mockResolvedValueOnce(mockInviter) // For inviter
          .mockResolvedValueOnce(existingActiveUser) // For existing user check

        // Act
        const result = await service.createInvitation(mockUser.id, createInvitationDto)

        // Assert
        expect(result).toEqual({
          message: expect.any(String)
        })

        // Verify - should not create a new user or token
        expect(prismaService.user.create).not.toHaveBeenCalled()
        expect(jwtService.sign).not.toHaveBeenCalled()
      })
    })

    describe('when errors occur', () => {
      it('should throw BadRequestException if no account or entity IDs are provided', async () => {
        // Act & Assert
        await expect(service.createInvitation(mockUser.id, { ...createInvitationDto, accountIds: [], entityIds: [] })).rejects.toThrow(BadRequestException)
      })

      it('should throw NotFoundException if inviter is not found', async () => {
        // Arrange
        prismaService.user.findUnique.mockResolvedValueOnce(null) // Inviter not found

        // Act & Assert
        await expect(service.createInvitation(mockUser.id, createInvitationDto)).rejects.toThrow(NotFoundException)
      })

      it('should throw UnauthorizedException if user lacks required permissions', async () => {
        // Arrange
        const inviterWithoutPermissions = {
          ...mockInviter,
          rolesLinked: [
            {
              role: {
                permissionsLinked: []
              }
            }
          ]
        }
        prismaService.user.findUnique.mockResolvedValueOnce(inviterWithoutPermissions)

        // Act & Assert
        await expect(service.createInvitation(mockUser.id, createInvitationDto)).rejects.toThrow(UnauthorizedException)
      })

      it('should throw UnauthorizedException if user lacks access to specified accounts', async () => {
        // Arrange
        const inviterWithLimitedAccess = {
          ...mockInviter,
          accountsLinked: []
        }
        prismaService.user.findUnique.mockResolvedValueOnce(inviterWithLimitedAccess)

        // Act & Assert
        await expect(service.createInvitation(mockUser.id, createInvitationDto)).rejects.toThrow(UnauthorizedException)
      })

      it('should handle database error gracefully', async () => {
        // Arrange
        prismaService.user.findUnique.mockResolvedValueOnce(mockInviter)
        prismaService.user.findUnique.mockRejectedValueOnce(new Error('Database error'))

        // Act & Assert
        await expect(service.createInvitation(mockUser.id, createInvitationDto)).rejects.toThrow(BadRequestException)

        // Verify
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create invitation'), 'createInvitation')
      })
    })
  })

  describe('acceptInvitation', () => {
    const acceptInvitationDto = {
      invitationToken: 'mock.invitation.token',
      password: 'NewSecurePassword123',
      firstname: 'Invited',
      lastname: 'User',
      locale: Locale.FR
    }

    const mockTokenPayload = {
      email: 'invited@test.com',
      sub: '2',
      firstname: 'Invited',
      lastname: 'User',
      roleIds: [1],
      accountIds: [mockAccount.id],
      entityIds: [mockEntity.id],
      locale: Locale.FR
    }

    const mockInvitation = {
      id: 'invitation-1',
      inviterUserId: '1',
      inviteeUserEmail: 'invited@test.com',
      status: 'SENT',
      accountsLinked: [{ accountId: mockAccount.id }],
      entitiesLinked: [{ entityId: mockEntity.id }],
      rolesLinked: [{ roleId: 1 }]
    }

    describe('when successful', () => {
      beforeEach(() => {
        jwtService.verify.mockReturnValue(mockTokenPayload)
        prismaService.userToken.findFirst.mockResolvedValue({
          id: '1',
          userId: '2',
          token: acceptInvitationDto.invitationToken,
          type: TokenType.INVITATION,
          expiresAt: new Date(Date.now() + 86400000),
          user: {
            id: '2',
            email: mockTokenPayload.email,
            isActive: false,
            password: ''
          }
        })
        prismaService.invitation.findFirst.mockResolvedValue(mockInvitation)
        prismaService.user.findUnique.mockResolvedValue({
          id: '2',
          email: mockTokenPayload.email,
          isActive: false,
          password: ''
        })
        prismaService.user.update.mockResolvedValue({
          id: '2',
          email: mockTokenPayload.email,
          isActive: true,
          password: 'hashed-password'
        })
        prismaService.invitation.update.mockResolvedValue({
          ...mockInvitation,
          status: 'ACCEPTED',
          inviteeUserId: '2',
          acceptedAt: new Date()
        })
        prismaService.userToken.delete.mockResolvedValue({ id: '1' })

        authService.generateTokens.mockResolvedValue({
          accessToken: 'mock.access.token',
          refreshToken: 'mock.refresh.token'
        })
        authService.createAndActivateUserProfile.mockResolvedValue({
          id: '2',
          email: mockTokenPayload.email,
          isActive: true
        })
      })

      it('should accept invitation successfully', async () => {
        // Act
        const result = await service.acceptInvitation(acceptInvitationDto)

        // Assert
        expect(result).toEqual({
          userId: '2',
          accessToken: 'mock.access.token',
          refreshToken: 'mock.refresh.token'
        })

        // Verify
        expect(jwtService.verify).toHaveBeenCalledWith(acceptInvitationDto.invitationToken, expect.any(Object))
        expect(prismaService.user.update).toHaveBeenCalled()
        expect(authService.generateTokens).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '2',
            email: mockTokenPayload.email
          })
        )

        // Verify that the invitation is updated to ACCEPTED status
        expect(prismaService.invitation.update).toHaveBeenCalledWith({
          where: { id: mockInvitation.id },
          data: expect.objectContaining({
            status: 'ACCEPTED',
            inviteeUserId: '2',
            acceptedAt: expect.any(Date)
          })
        })

        // Verify that the token is deleted after use
        expect(prismaService.userToken.delete).toHaveBeenCalledWith({
          where: { id: '1' }
        })
      })
    })

    describe('when errors occur', () => {
      it('should throw UnauthorizedException if token is invalid', async () => {
        // Arrange
        jwtService.verify.mockImplementation(() => {
          throw new Error('Invalid token')
        })

        // Act & Assert
        await expect(service.acceptInvitation(acceptInvitationDto)).rejects.toThrow(UnauthorizedException)
      })

      it('should throw NotFoundException if token is not found in database', async () => {
        // Arrange
        jwtService.verify.mockReturnValue(mockTokenPayload)
        prismaService.userToken.findFirst.mockResolvedValue(null)

        // Act & Assert
        await expect(service.acceptInvitation(acceptInvitationDto)).rejects.toThrow(NotFoundException)
      })

      it('should throw NotFoundException if invitation is not found', async () => {
        // Arrange
        jwtService.verify.mockReturnValue(mockTokenPayload)
        prismaService.userToken.findFirst.mockResolvedValue({
          id: '1',
          userId: '2',
          token: acceptInvitationDto.invitationToken,
          type: TokenType.INVITATION,
          expiresAt: new Date(Date.now() + 86400000),
          user: {
            id: '2',
            email: mockTokenPayload.email,
            isActive: false,
            password: ''
          }
        })
        prismaService.invitation.findFirst.mockResolvedValue(null)

        // Act & Assert
        await expect(service.acceptInvitation(acceptInvitationDto)).rejects.toThrow(NotFoundException)
      })

      it('should throw BadRequestException if user is not found', async () => {
        // Arrange
        jwtService.verify.mockReturnValue(mockTokenPayload)
        prismaService.userToken.findFirst.mockResolvedValue({
          id: '1',
          userId: '2',
          token: acceptInvitationDto.invitationToken,
          type: TokenType.INVITATION,
          expiresAt: new Date(Date.now() + 86400000),
          user: null
        })
        prismaService.invitation.findFirst.mockResolvedValue(mockInvitation)
        prismaService.user.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(service.acceptInvitation(acceptInvitationDto)).rejects.toThrow(BadRequestException)
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to accept invitation'), 'acceptInvitation')
      })

      it('should handle database error gracefully', async () => {
        // Arrange
        jwtService.verify.mockReturnValue(mockTokenPayload)
        prismaService.userToken.findFirst.mockResolvedValue({
          id: '1',
          userId: '2',
          token: acceptInvitationDto.invitationToken,
          type: TokenType.INVITATION,
          expiresAt: new Date(Date.now() + 86400000),
          user: {
            id: '2',
            email: mockTokenPayload.email,
            isActive: false,
            password: ''
          }
        })
        prismaService.invitation.findFirst.mockResolvedValue(mockInvitation)
        prismaService.user.findUnique.mockResolvedValue({
          id: '2',
          email: mockTokenPayload.email,
          isActive: false,
          password: ''
        })
        prismaService.user.update.mockRejectedValue(new Error('Database error'))

        // Act & Assert
        await expect(service.acceptInvitation(acceptInvitationDto)).rejects.toThrow(BadRequestException)

        // Verify
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to accept invitation'), 'acceptInvitation')
      })
    })
  })

  describe('getUserInvitations', () => {
    const userId = mockUser.id
    const mockInvitations = [
      {
        id: '1',
        inviterUserId: userId,
        inviteeUserId: null,
        inviteeUserEmail: 'invited1@test.com',
        status: 'SENT',
        invitedAt: new Date(),
        acceptedAt: null,
        accountsLinked: [
          {
            account: {
              id: mockAccount.id,
              name: 'Test Account'
            }
          }
        ],
        entitiesLinked: [
          {
            entity: {
              id: mockEntity.id,
              name: 'Test Entity'
            }
          }
        ],
        rolesLinked: [
          {
            role: {
              id: 1,
              name: 'User'
            }
          }
        ]
      },
      {
        id: '2',
        inviterUserId: userId,
        inviteeUserId: 'user-2',
        inviteeUserEmail: 'invited2@test.com',
        status: 'ACCEPTED',
        invitedAt: new Date(Date.now() - 86400000), // 1 day ago
        acceptedAt: new Date(),
        accountsLinked: [
          {
            account: {
              id: mockAccount.id,
              name: 'Test Account'
            }
          }
        ],
        entitiesLinked: [],
        rolesLinked: [
          {
            role: {
              id: 1,
              name: 'User'
            }
          }
        ]
      }
    ]

    it('should return all invitations sent by a user', async () => {
      // Arrange
      prismaService.invitation.findMany.mockResolvedValue(mockInvitations)

      // Act
      const result = await service.getUserInvitations(userId)

      // Assert
      expect(result).toEqual({
        invitations: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            inviterUserId: userId,
            inviteeUserEmail: 'invited1@test.com',
            status: 'SENT'
          }),
          expect.objectContaining({
            id: '2',
            inviterUserId: userId,
            inviteeUserId: 'user-2',
            inviteeUserEmail: 'invited2@test.com',
            status: 'ACCEPTED'
          })
        ])
      })

      // Verify
      expect(prismaService.invitation.findMany).toHaveBeenCalledWith({
        where: {
          inviterUserId: userId,
          status: {
            not: 'CANCELED'
          }
        },
        include: {
          accountsLinked: {
            include: {
              account: true
            }
          },
          entitiesLinked: {
            include: {
              entity: true
            }
          },
          rolesLinked: {
            include: {
              role: true
            }
          }
        },
        orderBy: { invitedAt: 'desc' }
      })
    })

    it('should return empty array when user has no invitations', async () => {
      // Arrange
      prismaService.invitation.findMany.mockResolvedValue([])

      // Act
      const result = await service.getUserInvitations(userId)

      // Assert
      expect(result).toEqual({ invitations: [] })
    })

    it('should handle database error gracefully', async () => {
      // Arrange
      prismaService.invitation.findMany.mockRejectedValue(new Error('Database error'))

      // Act & Assert
      await expect(service.getUserInvitations(userId)).rejects.toThrow(Error)
      expect(prismaService.invitation.findMany).toHaveBeenCalledWith({
        where: {
          inviterUserId: userId,
          status: {
            not: 'CANCELED'
          }
        },
        include: {
          accountsLinked: {
            include: {
              account: true
            }
          },
          entitiesLinked: {
            include: {
              entity: true
            }
          },
          rolesLinked: {
            include: {
              role: true
            }
          }
        },
        orderBy: { invitedAt: 'desc' }
      })
    })
  })
})
