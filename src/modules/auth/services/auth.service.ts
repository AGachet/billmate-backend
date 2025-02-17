/**
 * Resources
 */
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import ms from 'ms'
import { Response } from 'express'

/**
 * Dependencies
 */
import { PrismaService } from '@configs/prisma/prisma.service'
import { Logger } from '@common/services/logger.service'
import { SignInDto } from '@modules/auth/dto/signin.dto'
import { EnvConfig } from '@configs/env/env.config'

/**
 * Type
 */
import type { User } from '@prisma/client'

interface TokenPayload {
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
  async signIn({ email, password, confirmAccountToken }: SignInDto): Promise<AuthTokens> {
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
    return { accessToken, refreshToken }
  }

  async signOut(userId: string): Promise<{ message: string }> {
    this.logger.debug(`Logging out user with ID: ${userId}`, 'signout')

    // Delete refresh tokens from the database
    await this.prisma.userTokens.deleteMany({
      where: {
        userId,
        type: 'REFRESH'
      }
    })

    this.logger.debug(`User ${userId} logged out successfully`, 'signOut')
    return { message: 'Logged out successfully' }
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
    const tokenRecord = await this.prisma.userTokens.findFirst({
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

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: { isActive: true }
    })

    // Delete the token after activation
    await this.prisma.userTokens.delete({
      where: { id: tokenRecord.id }
    })

    this.logger.debug(`Account activated for ${email}`, 'activateUserAccount')
    return updatedUser
  }

  private async generateTokens(user: { email: string; id: string }): Promise<AuthTokens> {
    const payload: TokenPayload = { email: user.email, sub: user.id }

    // Default secret and expiresIn for access token (from auth.module.ts)
    const accessToken = this.jwtService.sign(payload)

    // Custom secret and expiresIn for refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.env.get('JWT_SECRET_REFRESH'),
      expiresIn: this.env.get('JWT_REFRESH_EXPIRES_IN')
    })

    // Store the refresh token in the UserTokens table
    await this.prisma.userTokens.create({
      data: {
        userId: user.id,
        token: refreshToken,
        type: 'REFRESH',
        expiresAt: new Date(Date.now() + ms(this.env.get('JWT_REFRESH_EXPIRES_IN')))
      }
    })

    this.logger.debug(`Tokens generated successfully for ${user.email}`, 'generateTokens')
    return { accessToken, refreshToken }
  }

  private async verifyToken(token: string, secret: string): Promise<TokenPayload> {
    try {
      return this.jwtService.verify(token, { secret }) as TokenPayload
    } catch {
      this.logger.warn(`Invalid token: ${token}`, 'verifyToken')
      throw new UnauthorizedException('Invalid token')
    }
  }

  /**
   * Shared methods
   */
  async validateAccessToken(token: string): Promise<User> {
    const payload = await this.verifyToken(token, this.env.get('JWT_SECRET_AUTH'))
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    })

    if (!user) {
      this.logger.warn(`User not found: ${payload.sub}`, 'validateAccessToken')
      throw new UnauthorizedException('User not found')
    }

    return user
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyToken(refreshToken, this.env.get('JWT_SECRET_REFRESH'))

    const tokenRecord = await this.prisma.userTokens.findFirst({
      where: {
        userId: payload.sub,
        token: refreshToken,
        type: 'REFRESH'
      }
    })

    if (!tokenRecord) {
      this.logger.warn(`Invalid refresh token: ${refreshToken}`, 'refreshTokens')
      throw new UnauthorizedException('Invalid refresh token')
    }

    return this.generateTokens({ id: payload.sub, email: payload.email })
  }

  setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.env.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/'
    })
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.env.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/'
    })
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: this.env.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/'
    })
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.env.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/'
    })
  }
}
