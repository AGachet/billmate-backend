/**
 * Resources
 */
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Response } from 'express'
import * as bcrypt from 'bcrypt'
import ms from 'ms'

/**
 * Dependencies
 */
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { Logger } from '@common/services/logger/logger.service'
import { EnvConfig } from '@configs/env/services/env.service'
import { UserDefaults } from '@configs/db/user.config'

/**
 * Type
 */
import type { User, UserToken } from '@prisma/client'

import type { SignUpDto } from '@modules/auth/dto/requests/signup.dto'
import type { SignInDto } from '@modules/auth/dto/requests/signin.dto'
import type { SignOutDto } from '@modules/auth/dto/requests/signout.dto'
import type { ResetPasswordDto } from '@modules/auth/dto/requests/reset-password.dto'
import type { RequestPasswordResetDto } from '@modules/auth/dto/requests/request-password-reset.dto'

import type { SignUpResponseDto } from '@modules/auth/dto/responses/signup.response.dto'
import type { SignInResponseDto } from '@modules/auth/dto/responses/signin.response.dto'
import type { SignOutResponseDto } from '@modules/auth/dto/responses/signout.response.dto'
import type { RequestPasswordResetResponseDto } from '@modules/auth/dto/responses/request-password-reset.response.dto'
import type { ResetPasswordResponseDto } from '@modules/auth/dto/responses/reset-password.response.dto'
import type { MeResponseDto } from '@modules/auth/dto/responses/me.response.dto'

export interface TokenPayload {
  email: string
  sub: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

/**
 * Declaration
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
    private readonly env: EnvConfig
  ) {}

  /**
   * End points methods
   */
  async signUp(signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    const { email, password, firstname, lastname } = signUpDto

    this.logger.debug(`Sign-up attempt for ${email}`, 'signUp')

    // Check if the user already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      this.logger.warn(`Sign-up attempt with existing email: ${email}`, 'signUp')
      return {
        message: 'If the email address is valid, you will receive a confirmation email shortly.'
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user (inactive by default)
    const user = await this.prisma.user.create({
      data: {
        email,
        firstname,
        lastname,
        password: hashedPassword,
        isActive: false
      }
    })

    // Generate the confirmation token
    const confirmationToken = this.jwtService.sign(
      { email: user.email, sub: user.id },
      {
        secret: this.env.get('JWT_SECRET_CONFIRM_ACCOUNT'),
        expiresIn: this.env.get('JWT_CREATE_ACCOUNT_EXPIRES_IN')
      }
    )

    // Save the token in the database
    await this.prisma.userToken.create({
      data: {
        userId: user.id,
        token: confirmationToken,
        type: 'ACCOUNT_VALIDATION',
        expiresAt: new Date(Date.now() + ms(this.env.get('JWT_CREATE_ACCOUNT_EXPIRES_IN')))
      }
    })

    // Log the token in development and test
    if (['development', 'test'].includes(this.env.get('NODE_ENV'))) {
      this.logger.debug(`User created successfully. \n\n------ Confirmation token for ${email} ------ \n${confirmationToken}\n`, 'signUp')
      return {
        message: 'If the email address is valid, you will receive a confirmation email shortly.',
        confirmationToken // Only displayed in development and test
      }
    }

    // TODO: Send the email with the token
    // await this.mailService.sendConfirmationEmail(email, confirmationToken)

    this.logger.debug(`Sign-up successful for ${email}`, 'signUp')
    return {
      message: 'If the email address is valid, you will receive a confirmation email shortly.'
    }
  }

  async signIn(signInDto: SignInDto): Promise<SignInResponseDto & AuthTokens> {
    const { email, password, confirmAccountToken } = signInDto

    this.logger.debug(`Sign-in attempt for ${email}`, 'signIn')

    // Validate user
    const user = await this.validateUser(email, password)

    // Activate user account if a token is provided
    if (confirmAccountToken) await this.activateUserAccount(user.id, email, confirmAccountToken)

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user)

    // Update last login date
    await this.prisma.user.update({
      where: { email },
      data: { lastLoginAt: new Date() }
    })

    this.logger.debug(`Sign-in attempt successfully for ${email}`, 'signIn')
    return { accessToken, refreshToken, userId: user.id }
  }

  async signOut(signOutDto: SignOutDto): Promise<SignOutResponseDto> {
    const { userId } = signOutDto

    this.logger.debug(`Logging out user with ID: ${userId}`, 'signout')

    // Delete refresh tokens from the database
    await this.prisma.userToken.deleteMany({
      where: {
        userId,
        type: 'SESSION_REFRESH'
      }
    })

    this.logger.debug(`User ${userId} logged out successfully`, 'signOut')
    return { message: 'Logged out successfully' }
  }

  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto): Promise<RequestPasswordResetResponseDto> {
    const { email } = requestPasswordResetDto

    this.logger.debug(`Password reset requested for ${email}`, 'requestPasswordReset')

    // Get user with roles and check access in one query
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        rolesLinked: {
          include: {
            role: {
              include: {
                modulesLinked: {
                  where: {
                    module: {
                      name: 'USER_ACCOUNT_PASSWORD_RECOVERY'
                    }
                  }
                },
                permissionsLinked: {
                  where: {
                    permission: {
                      name: 'PASSWORD_RECOVERY_LINK_REQUEST_OWN'
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    // If the user does not exist or does not have the permissions, still return a success message
    if (!user || !user.rolesLinked.some((userRole) => userRole.role.modulesLinked.length > 0) || !user.rolesLinked.some((userRole) => userRole.role.permissionsLinked.length > 0)) {
      this.logger.warn(`Password reset requested for non-existent user or without permissions: ${email}`, 'requestPasswordReset')
      return { message: 'If the email address is valid and has permission to reset password, you will receive reset instructions shortly.' }
    }

    // Generate reset token
    const resetToken = this.jwtService.sign(
      { email: user.email, sub: user.id },
      {
        secret: this.env.get('JWT_SECRET_RESET_PASSWORD'),
        expiresIn: this.env.get('JWT_RESET_PASSWORD_EXPIRES_IN')
      }
    )

    // Save token in database
    await this.prisma.userToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + ms(this.env.get('JWT_RESET_PASSWORD_EXPIRES_IN')))
      }
    })

    // Return token in development and test
    if (['development', 'test'].includes(this.env.get('NODE_ENV'))) {
      return {
        message: 'If the email address is valid and has permission to reset password, you will receive reset instructions shortly.',
        resetToken // Only in development and test
      }
    }

    // TODO: Send email with reset link
    this.logger.debug(`Password reset link sent to ${email}`, 'requestPasswordReset')
    return { message: 'If the email address is valid and has permission to reset password, you will receive reset instructions shortly.' }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    const { resetPasswordToken, password, confirmPassword } = resetPasswordDto

    this.logger.debug('Password reset attempt', 'resetPassword')

    if (password !== confirmPassword) {
      this.logger.warn('Passwords do not match', 'resetPassword')
      throw new BadRequestException('Passwords do not match')
    }

    const payload = await this.verifyToken(resetPasswordToken, this.env.get('JWT_SECRET_RESET_PASSWORD'))

    // Get token record and check access in one query
    const tokenRecord = await this.prisma.userToken.findFirst({
      where: {
        userId: payload.sub,
        token: resetPasswordToken,
        type: 'PASSWORD_RESET'
      },
      include: {
        user: {
          include: {
            rolesLinked: {
              include: {
                role: {
                  include: {
                    modulesLinked: {
                      where: {
                        module: {
                          name: 'USER_ACCOUNT_PASSWORD_RECOVERY'
                        }
                      }
                    },
                    permissionsLinked: {
                      where: {
                        permission: {
                          name: 'PASSWORD_RECOVERY_RESET_OWN'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!tokenRecord) {
      this.logger.warn(`Invalid or expired reset password token for ${payload.email}`, 'resetPassword')
      throw new BadRequestException('Invalid or expired reset password token')
    }

    // Check if user has access to password reset
    const hasModuleAccess = tokenRecord.user.rolesLinked.some((userRole) => userRole.role.modulesLinked.length > 0)
    const hasPermission = tokenRecord.user.rolesLinked.some((userRole) => userRole.role.permissionsLinked.length > 0)

    if (!hasModuleAccess || !hasPermission) {
      this.logger.warn(`User ${payload.email} does not have access to password reset`, 'resetPassword')
      throw new UnauthorizedException('You do not have permission to reset passwords')
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { password: hashedPassword }
    })

    // Delete used token
    await this.prisma.userToken.delete({
      where: { id: tokenRecord.id }
    })

    this.logger.debug(`Password reset successfully for ${payload.email}`, 'resetPassword')
    return { message: 'Password has been reset successfully' }
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    this.logger.debug(`Getting user information for ${userId}`, 'getMe')

    // Get user with roles, modules and permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rolesLinked: {
          where: {
            role: {
              isActive: true
            }
          },
          include: {
            role: {
              include: {
                modulesLinked: {
                  where: {
                    module: {
                      isActive: true
                    }
                  },
                  include: {
                    module: true
                  }
                },
                permissionsLinked: {
                  include: {
                    permission: {
                      include: {
                        module: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      this.logger.warn(`User not found: ${userId}`, 'getMe')
      throw new BadRequestException('User not found')
    }

    // Extract active roles
    const roles = user.rolesLinked.map((userRole) => userRole.role.name)

    // Extract modules from active roles (modules attached and active)
    const modules = user.rolesLinked.flatMap((userRole) => userRole.role.modulesLinked.map((moduleLink) => moduleLink.module.name)).filter((value, index, self) => self.indexOf(value) === index) // Remove possible duplicates

    // Extract permissions from active roles (permissions attached to active roles and modules)
    const permissions = user.rolesLinked
      .flatMap((userRole) => userRole.role.permissionsLinked.filter((permissionLink) => permissionLink.permission.module?.isActive).map((permissionLink) => permissionLink.permission.name))
      .filter((value, index, self) => self.indexOf(value) === index) // Remove possible duplicates

    return {
      userId: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      roles,
      modules,
      permissions,
      createdAt: user.createdAt
    }
  }

  /**
   * Privates methods
   */
  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      this.logger.warn(`User not found: ${email}`, 'validateUser')
      throw new UnauthorizedException('Invalid email or password')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`, 'validateUser')
      throw new UnauthorizedException('Invalid email or password')
    }

    this.logger.debug(`User ${email} validated successfully`, 'validateUser')
    return user
  }

  private async activateUserAccount(userId: string, email: string, confirmAccountToken: string): Promise<User> {
    await this.verifyToken(confirmAccountToken, this.env.get('JWT_SECRET_CONFIRM_ACCOUNT'))

    // Find the token record
    const tokenRecord = await this.prisma.userToken.findFirst({
      where: {
        userId,
        token: confirmAccountToken,
        type: 'ACCOUNT_VALIDATION'
      }
    })

    if (!tokenRecord) {
      this.logger.warn(`Invalid confirmation token for ${email}`, 'activateUserAccount')
      throw new BadRequestException('Invalid confirmation token')
    }

    // Update user with isActive status, default role and create default preferences
    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: {
        isActive: true,
        rolesLinked: {
          create: {
            roleId: UserDefaults.roles.default
          }
        },
        preference: {
          create: {
            locale: UserDefaults.preferences.locale
          }
        }
      }
    })

    // Delete the token after activation
    await this.prisma.userToken.delete({
      where: { id: tokenRecord.id }
    })

    this.logger.debug(`Account activated for ${email}`, 'activateUserAccount')
    return updatedUser
  }

  private async generateTokens(user: { email: string; id: string }, existingTokenRecord?: UserToken): Promise<AuthTokens> {
    const payload: TokenPayload = { email: user.email, sub: user.id }

    // Default secret and expiresIn for access token (from auth.module.ts)
    const accessToken = this.jwtService.sign(payload)

    // Check if the refresh token exists and is still valid
    if (existingTokenRecord?.expiresAt) {
      const remainingTime = existingTokenRecord.expiresAt.getTime() - Date.now()
      const oneDay = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

      if (remainingTime > oneDay) {
        return { accessToken, refreshToken: existingTokenRecord.token }
      }
    }

    // Generate new refresh token if needed
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.env.get('JWT_SECRET_REFRESH'),
      expiresIn: this.env.get('JWT_REFRESH_EXPIRES_IN')
    })

    // Store the new refresh token in the UserTokens table
    await this.prisma.userToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        type: 'SESSION_REFRESH',
        expiresAt: new Date(Date.now() + ms(this.env.get('JWT_REFRESH_EXPIRES_IN')))
      }
    })

    this.logger.debug(`Tokens generated successfully for ${user.email}`, 'generateTokens')
    return { accessToken, refreshToken }
  }

  /**
   * Shared methods
   */
  public async verifyToken(token: string, secret: string): Promise<TokenPayload> {
    try {
      return this.jwtService.verify(token, { secret }) as TokenPayload
    } catch {
      this.logger.warn(`Invalid token: ${token}`, 'verifyToken')
      throw new UnauthorizedException('Invalid token')
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyToken(refreshToken, this.env.get('JWT_SECRET_REFRESH'))

    const tokenRecord = await this.prisma.userToken.findFirst({
      where: {
        userId: payload.sub,
        token: refreshToken,
        type: 'SESSION_REFRESH'
      }
    })

    if (!tokenRecord) {
      this.logger.warn(`Invalid refresh token: ${refreshToken}`, 'refreshTokens')
      throw new UnauthorizedException('Invalid refresh token')
    }

    return this.generateTokens({ id: payload.sub, email: payload.email }, tokenRecord)
  }

  setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    this.logger.debug('Setting auth cookies for user', 'setAuthCookies')
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: !['development', 'test'].includes(this.env.get('NODE_ENV')),
      sameSite: 'strict',
      path: '/'
    })
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: !['development', 'test'].includes(this.env.get('NODE_ENV')),
      sameSite: 'strict',
      path: '/'
    })
  }

  clearAuthCookies(response: Response): void {
    this.logger.debug('Clearing auth cookies for user', 'clearAuthCookies')
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: !['development', 'test'].includes(this.env.get('NODE_ENV')),
      sameSite: 'strict',
      path: '/'
    })
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: !['development', 'test'].includes(this.env.get('NODE_ENV')),
      sameSite: 'strict',
      path: '/'
    })
  }
}
