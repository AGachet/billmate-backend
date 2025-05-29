// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Unit tests for AuthService
 */
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { Response } from 'express'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { EnvConfig } from '@configs/env/services/env.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { AuthService } from '@modules/auth/services/auth.service'
import { EmailService } from '@modules/email/services/email.service'

/**
 * Test utilities and mocks
 */
import { mockEmailService, mockEnvConfig, mockJwtService, mockLogger, mockPrismaService } from '@common/tests/unit/mocks/service-mocks'
import { mockAccount, mockToken, mockUser } from '@common/tests/unit/mocks/test-data'
import { clearAllMocks, createMockResponse, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Mocks
 */
jest.mock('bcrypt')

/**
 * Test data
 */
const mockTokenRecord = {
  id: '1',
  userId: mockUser.id,
  token: 'valid.refresh.token',
  type: 'SESSION_REFRESH',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  user: {
    ...mockUser,
    rolesLinked: [
      {
        role: {
          modulesLinked: [{ module: { name: 'USER_ACCOUNT_PASSWORD_RECOVERY' } }],
          permissionsLinked: [{ permission: { name: 'PASSWORD_RECOVERY_RESET_OWN' } }]
        }
      }
    ]
  }
}

/**
 * Test suite
 */
describe('AuthService', () => {
  let service: AuthService
  let prismaService: jest.Mocked<PrismaService>
  let jwtService: jest.Mocked<JwtService>
  let logger: jest.Mocked<Logger>

  beforeEach(async () => {
    clearAllMocks()

    // Configure mock implementations
    mockJwtService.sign.mockReturnValue(mockToken)
    mockJwtService.verify.mockReturnValue({ email: mockUser.email, sub: mockUser.id })

    mockEnvConfig.get.mockImplementation((key: string) => {
      const envValues: Record<string, string> = {
        NODE_ENV: 'test',
        JWT_SECRET_AUTH: 'auth-secret',
        JWT_SECRET_REFRESH: 'refresh-secret',
        JWT_SECRET_CONFIRM_ACCOUNT: 'confirm-secret',
        JWT_SECRET_RESET_PASSWORD: 'reset-secret',
        JWT_AUTH_EXPIRES_IN: '1h',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_CREATE_ACCOUNT_EXPIRES_IN: '24h',
        JWT_RESET_PASSWORD_EXPIRES_IN: '1h'
      }
      return envValues[key] || ''
    })

    const module = await createTestingModule([
      AuthService,
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
      }
    ])

    service = module.get<AuthService>(AuthService)
    prismaService = module.get(PrismaService)
    jwtService = module.get(JwtService)
    logger = module.get(Logger)
  })

  describe('signUp', () => {
    const signUpDto = {
      email: 'test@example.com',
      password: 'password123',
      firstname: 'John',
      lastname: 'Doe'
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue(null)
        prismaService.user.create.mockResolvedValue(mockUser)
        prismaService.userToken.create.mockResolvedValue({ id: '1', token: mockToken })
        ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword')
      })

      it('should create a new user successfully', async () => {
        // Act
        const result = await service.signUp(signUpDto)

        // Assert
        expect(result).toEqual({
          message: 'If the email address is valid, you will receive a confirmation email shortly.',
          confirmationToken: mockToken
        })

        // Verify
        expect(prismaService.user.create).toHaveBeenCalledWith({
          data: {
            email: signUpDto.email,
            password: 'hashedPassword',
            isActive: false
          }
        })
        expect(logger.debug).toHaveBeenCalledWith('Sign-up attempt for test@example.com', 'signUp')
      })
    })

    describe('when user already exists', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue(mockUser)
      })

      it('should handle existing user gracefully', async () => {
        // Act
        const result = await service.signUp(signUpDto)

        // Assert
        expect(result).toEqual({
          message: 'If the email address is valid, you will receive a confirmation email shortly.'
        })

        // Verify
        expect(prismaService.user.create).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith('Sign-up attempt with existing email: test@example.com', 'signUp')
      })
    })
  })

  describe('signIn', () => {
    const signInDto = {
      email: 'test@example.com',
      password: 'password123'
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue(mockUser)
        ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
        prismaService.userToken.create.mockResolvedValue({ id: '1', token: mockToken })
      })

      it('should sign in user successfully', async () => {
        // Act
        const result = await service.signIn(signInDto)

        // Assert
        expect(result).toEqual({
          userId: mockUser.id,
          accessToken: mockToken,
          refreshToken: mockToken
        })

        // Verify
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { email: signInDto.email },
          data: expect.any(Object)
        })
        expect(logger.debug).toHaveBeenCalledWith('Sign-in attempt for test@example.com', 'signIn')
      })
    })

    describe('when credentials are invalid', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue(mockUser)
        ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
      })

      it('should throw UnauthorizedException if credentials are invalid', async () => {
        // Act & Assert
        await expect(service.signIn(signInDto)).rejects.toThrow(UnauthorizedException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Invalid password for user: test@example.com', 'validateUser')
      })
    })

    describe('when signing in with confirmation token', () => {
      const signInWithTokenDto = {
        ...signInDto,
        firstname: 'John',
        lastname: 'Doe',
        confirmAccountToken: 'valid.token'
      }

      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue({
          ...mockUser,
          isActive: false
        })
        ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
        jwtService.verify.mockReturnValue({ email: mockUser.email, sub: mockUser.id })
        prismaService.userToken.findFirst.mockResolvedValue({
          id: '1',
          userId: mockUser.id,
          token: 'valid.token',
          type: 'ACCOUNT_VALIDATION'
        })
        prismaService.people.create.mockResolvedValue({
          id: '2',
          firstname: 'John',
          lastname: 'Doe',
          email: 'test@example.com'
        })
        prismaService.account.create.mockResolvedValue(mockAccount)
        prismaService.user.update.mockResolvedValue({
          ...mockUser,
          isActive: true,
          peopleId: '2'
        })
        prismaService.userToken.create.mockResolvedValue({ id: '1', token: mockToken })
      })

      it('should create account when signing in with confirmation token', async () => {
        // Act
        const result = await service.signIn(signInWithTokenDto)

        // Assert
        expect(result).toEqual({
          userId: mockUser.id,
          accessToken: mockToken,
          refreshToken: mockToken
        })

        // Verify
        expect(prismaService.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { email: signInWithTokenDto.email }
          })
        )
        expect(prismaService.account.create).toHaveBeenCalled()
      })
    })
  })

  describe('signOut', () => {
    const signOutDto = {
      userId: '1'
    }

    it('should sign out user successfully', async () => {
      // Arrange
      prismaService.userToken.deleteMany.mockResolvedValue({ count: 1 })

      // Act
      const result = await service.signOut(signOutDto)

      // Assert
      expect(result).toEqual({ message: 'Logged out successfully' })

      // Verify
      expect(prismaService.userToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: signOutDto.userId,
          type: 'SESSION_REFRESH'
        }
      })
      expect(logger.debug).toHaveBeenCalledWith('Logging out user with ID: 1', 'signout')
    })
  })

  describe('requestPasswordReset', () => {
    const requestPasswordResetDto = {
      email: 'test@example.com'
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue({
          ...mockUser,
          rolesLinked: [
            {
              role: {
                modulesLinked: [{ module: { name: 'USER_ACCOUNT_PASSWORD_RECOVERY' } }],
                permissionsLinked: [{ permission: { name: 'PASSWORD_RECOVERY_LINK_REQUEST_OWN' } }]
              }
            }
          ]
        })
        prismaService.userToken.create.mockResolvedValue({ id: '1', token: mockToken })
      })

      it('should request password reset successfully', async () => {
        // Act
        const result = await service.requestPasswordReset(requestPasswordResetDto)

        // Assert
        expect(result).toEqual({
          message: 'If the email address is valid and has permission to reset password, you will receive reset instructions shortly.',
          resetToken: mockToken
        })

        // Verify
        expect(logger.debug).toHaveBeenCalledWith('Password reset requested for test@example.com', 'requestPasswordReset')
      })
    })

    describe('when user has no permission', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue({
          ...mockUser,
          rolesLinked: [
            {
              role: {
                modulesLinked: [],
                permissionsLinked: []
              }
            }
          ]
        })
      })

      it('should handle user without permission gracefully', async () => {
        // Act
        const result = await service.requestPasswordReset(requestPasswordResetDto)

        // Assert
        expect(result).toEqual({
          message: 'If the email address is valid and has permission to reset password, you will receive reset instructions shortly.'
        })

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Password reset requested for non-existent user or without permissions: test@example.com', 'requestPasswordReset')
      })
    })
  })

  describe('resetPassword', () => {
    const resetPasswordDto = {
      resetPasswordToken: 'valid.reset.token',
      password: 'newPassword123',
      confirmPassword: 'newPassword123'
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.userToken.findFirst.mockResolvedValue(mockTokenRecord)
        ;(bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword')
        prismaService.user.update.mockResolvedValue({ ...mockUser, password: 'newHashedPassword' })
        prismaService.userToken.delete.mockResolvedValue(mockTokenRecord)
      })

      it('should reset password successfully', async () => {
        // Act
        const result = await service.resetPassword(resetPasswordDto)

        // Assert
        expect(result).toEqual({ message: 'Password has been reset successfully' })

        // Verify
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: mockUser.id },
          data: { password: 'newHashedPassword' }
        })
        expect(prismaService.userToken.delete).toHaveBeenCalledWith({
          where: { id: mockTokenRecord.id }
        })
        expect(logger.debug).toHaveBeenCalledWith('Password reset attempt', 'resetPassword')
      })
    })

    describe('when errors occur', () => {
      it('should throw BadRequestException if passwords do not match', async () => {
        // Arrange
        const invalidDto = {
          ...resetPasswordDto,
          confirmPassword: 'differentPassword'
        }

        // Act & Assert
        await expect(service.resetPassword(invalidDto)).rejects.toThrow(BadRequestException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Passwords do not match', 'resetPassword')
      })

      it('should throw BadRequestException if token is invalid', async () => {
        // Arrange
        jwtService.verify.mockImplementation(() => {
          throw new UnauthorizedException('Invalid token')
        })

        // Act & Assert
        await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(UnauthorizedException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Invalid token: valid.reset.token', 'verifyToken')
      })

      it('should throw UnauthorizedException if user has no permission', async () => {
        // Arrange
        jwtService.verify.mockReturnValue({ email: mockUser.email, sub: mockUser.id })
        prismaService.userToken.findFirst.mockResolvedValue({
          ...mockTokenRecord,
          user: {
            ...mockUser,
            rolesLinked: [
              {
                role: {
                  modulesLinked: [],
                  permissionsLinked: []
                }
              }
            ]
          }
        })

        // Act & Assert
        await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(UnauthorizedException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith(`User ${mockUser.email} does not have access to password reset`, 'resetPassword')
      })
    })
  })

  describe('getMe', () => {
    describe('when successful', () => {
      beforeEach(() => {
        // Arrange
        prismaService.user.findUnique.mockResolvedValue({
          ...mockUser,
          people: {
            id: '2',
            firstname: 'Bruce',
            lastname: 'Wayne',
            email: mockUser.email,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          rolesLinked: [
            {
              role: {
                name: 'USER',
                modulesLinked: [
                  {
                    module: {
                      name: 'USER_ACCOUNT',
                      isActive: true
                    }
                  }
                ],
                permissionsLinked: [
                  {
                    permission: {
                      name: 'READ_OWN_PROFILE',
                      module: {
                        isActive: true
                      }
                    }
                  }
                ]
              }
            }
          ],
          accountsLinked: [
            {
              account: {
                id: mockAccount.id,
                name: mockAccount.name,
                description: mockAccount.description,
                isActive: mockAccount.isActive
              }
            }
          ],
          entitiesLinked: []
        })
      })

      it('should return user information successfully', async () => {
        // Act
        const result = await service.getMe(mockUser.id)

        // Assert
        expect(result).toEqual({
          userId: mockUser.id,
          email: mockUser.email,
          people: {
            firstname: 'Bruce',
            lastname: 'Wayne'
          },
          roles: ['USER'],
          modules: ['USER_ACCOUNT'],
          permissions: ['READ_OWN_PROFILE'],
          accounts: [
            {
              id: mockAccount.id,
              name: mockAccount.name,
              description: mockAccount.description,
              isActive: mockAccount.isActive
            }
          ],
          entities: [],
          createdAt: mockUser.createdAt
        })

        // Verify
        expect(logger.debug).toHaveBeenCalledWith('Getting user information for 1', 'getMe')
      })
    })

    describe('when errors occur', () => {
      beforeEach(() => {
        prismaService.user.findUnique.mockResolvedValue(null)
      })

      it('should throw NotFoundException if user not found', async () => {
        // Act & Assert
        await expect(service.getMe('non-existent-id')).rejects.toThrow(NotFoundException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('User not found: non-existent-id', 'getMe')
      })
    })
  })

  describe('getGuest', () => {
    const mockGuestRole = {
      name: 'guest',
      isActive: true,
      modulesLinked: [
        {
          module: {
            name: 'USER_ACCOUNT_CREATION',
            isActive: true
          }
        }
      ],
      permissionsLinked: [
        {
          permission: {
            name: 'USER_ACCOUNT_CREATE_OWN',
            module: {
              isActive: true
            }
          }
        }
      ]
    }

    describe('when successful', () => {
      beforeEach(() => {
        prismaService.role.findFirst.mockResolvedValue(mockGuestRole)
      })

      it('should return guest information successfully', async () => {
        // Act
        const result = await service.getGuest()

        // Assert
        expect(result).toEqual({
          roles: ['guest'],
          modules: ['USER_ACCOUNT_CREATION'],
          permissions: ['USER_ACCOUNT_CREATE_OWN']
        })

        // Verify
        expect(logger.debug).toHaveBeenCalledWith('Getting guest user information', 'getGuest')
      })
    })

    describe('when guest role not found', () => {
      beforeEach(() => {
        prismaService.role.findFirst.mockResolvedValue(null)
      })

      it('should return empty arrays if guest role not found', async () => {
        // Act
        const result = await service.getGuest()

        // Assert
        expect(result).toEqual({
          roles: ['guest'],
          modules: [],
          permissions: []
        })

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Guest role not found, returning empty arrays', 'getGuest')
      })
    })

    describe('filtering inactive modules and permissions', () => {
      it('should filter out inactive modules', async () => {
        // Arrange
        prismaService.role.findFirst.mockResolvedValue({
          ...mockGuestRole,
          modulesLinked: [
            {
              module: {
                name: 'USER_ACCOUNT_CREATION',
                isActive: true
              }
            },
            {
              module: {
                name: 'INACTIVE_MODULE',
                isActive: false
              }
            }
          ]
        })

        // Act
        const result = await service.getGuest()

        // Assert
        expect(result.modules).toEqual(['USER_ACCOUNT_CREATION'])
        expect(result.modules).not.toContain('INACTIVE_MODULE')
      })

      it('should filter out permissions from inactive modules', async () => {
        // Arrange
        prismaService.role.findFirst.mockResolvedValue({
          ...mockGuestRole,
          permissionsLinked: [
            {
              permission: {
                name: 'USER_ACCOUNT_CREATE_OWN',
                module: {
                  isActive: true
                }
              }
            },
            {
              permission: {
                name: 'INACTIVE_MODULE_PERMISSION',
                module: {
                  isActive: false
                }
              }
            }
          ]
        })

        // Act
        const result = await service.getGuest()

        // Assert
        expect(result.permissions).toEqual(['USER_ACCOUNT_CREATE_OWN'])
        expect(result.permissions).not.toContain('INACTIVE_MODULE_PERMISSION')
      })
    })
  })

  describe('refreshTokens', () => {
    describe('when successful', () => {
      beforeEach(() => {
        jwtService.verify.mockReturnValue({ email: mockUser.email, sub: mockUser.id })
        prismaService.userToken.findFirst.mockResolvedValue(mockTokenRecord)
        jwtService.sign.mockReturnValueOnce('new.access.token').mockReturnValueOnce('valid.refresh.token')
      })

      it('should refresh tokens successfully', async () => {
        // Act
        const result = await service.refreshTokens('valid.refresh.token')

        // Assert
        expect(result).toEqual({
          accessToken: 'new.access.token',
          refreshToken: 'valid.refresh.token'
        })

        // Verify
        expect(logger.debug).toHaveBeenCalledWith(`Tokens generated successfully for ${mockUser.email}`, 'generateTokens')
      })
    })

    describe('when refresh token is expired', () => {
      beforeEach(() => {
        jwtService.verify.mockReturnValue({ email: mockUser.email, sub: mockUser.id })
        prismaService.userToken.findFirst.mockResolvedValue({
          ...mockTokenRecord,
          expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
        })
        jwtService.sign.mockReturnValueOnce('new.access.token').mockReturnValueOnce('new.refresh.token')
        prismaService.userToken.create.mockResolvedValue({
          ...mockTokenRecord,
          token: 'new.refresh.token'
        })
      })

      it('should generate new refresh token if current one is expired', async () => {
        // Act
        const result = await service.refreshTokens('valid.refresh.token')

        // Assert
        expect(result).toEqual({
          accessToken: 'new.access.token',
          refreshToken: 'new.refresh.token'
        })

        // Verify
        expect(logger.debug).toHaveBeenCalledWith(`Tokens generated successfully for ${mockUser.email}`, 'generateTokens')
      })
    })

    describe('when errors occur', () => {
      it('should throw UnauthorizedException if refresh token is invalid', async () => {
        // Arrange
        jwtService.verify.mockImplementation(() => {
          throw new Error('Invalid token')
        })

        // Act & Assert
        await expect(service.refreshTokens('invalid.token')).rejects.toThrow(UnauthorizedException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Invalid token: invalid.token', 'verifyToken')
      })

      it('should throw UnauthorizedException if user has been deleted', async () => {
        // Arrange
        jwtService.verify.mockReturnValue({ sub: '123' })
        prismaService.userToken.findFirst.mockResolvedValue(null)
        prismaService.user.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(service.refreshTokens('valid.refresh.token')).rejects.toThrow(UnauthorizedException)

        // Verify
        expect(logger.warn).toHaveBeenCalledWith('Invalid refresh token: valid.refresh.token', 'refreshTokens')
      })
    })
  })

  describe('Cookie Management', () => {
    it('should set auth cookies correctly', () => {
      // Arrange
      const mockResponse = createMockResponse()

      // Act
      service.setAuthCookies(mockResponse as unknown as Response, 'access.token', 'refresh.token')

      // Assert
      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', 'access.token', expect.any(Object))
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'refresh.token', expect.any(Object))
      expect(logger.debug).toHaveBeenCalledWith('Setting auth cookies for user', 'setAuthCookies')
    })

    it('should clear auth cookies correctly', () => {
      // Arrange
      const mockResponse = createMockResponse()

      // Act
      service.clearAuthCookies(mockResponse as unknown as Response)

      // Assert
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object))
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object))
      expect(logger.debug).toHaveBeenCalledWith('Clearing auth cookies for user', 'clearAuthCookies')
    })
  })
})
