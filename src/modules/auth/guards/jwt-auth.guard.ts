/**
 * Resources
 */
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Dependencies
 */
import { AuthService } from '@modules/auth/services/auth.service'
import { Logger } from '@common/services/logger.service'
import { EnvConfig } from '@configs/env/env.config'

/**
 * Type
 */
import type { Request, Response } from 'express'

/**
 * Declaration
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private authService: AuthService,
    private readonly logger: Logger,
    private readonly env: EnvConfig
  ) {
    super()
  }

  // Is allowed to activate
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    const accessToken = request.cookies['access_token']
    if (!accessToken) {
      this.logger.warn(`No access token found for ${request.ip} - ${request.originalUrl}`, 'JwtAuthGuard')
      return this.tryRefreshToken(context, request, response)
    }

    try {
      return (await super.canActivate(context)) as boolean
    } catch {
      this.logger.debug(`Access token expired, attempting refresh for ${request.ip}`, 'JwtAuthGuard')
      return this.tryRefreshToken(context, request, response)
    }
  }

  // Tries to refresh the user's access token using the refresh token
  private async tryRefreshToken(context: ExecutionContext, request: Request, response: Response): Promise<boolean> {
    this.logger.debug(`Attempting token refresh for ${request.ip}`, 'JwtAuthGuard')

    const refreshToken = request.cookies['refresh_token']
    if (!refreshToken) {
      this.logger.warn(`No refresh token found for ${request.ip}`, 'JwtAuthGuard')
      throw new UnauthorizedException('No refresh token provided.')
    }

    try {
      // Validate and refresh tokens
      const tokens = await this.authService.refreshTokens(refreshToken)
      this.authService.setAuthCookies(response, tokens.accessToken, tokens.refreshToken)
      this.logger.debug(`Tokens refreshed successfully for ${request.ip}`, 'JwtAuthGuard')

      // Update the request user with new token payload
      request.user = await this.authService.validateAccessToken(tokens.accessToken)
      return true
    } catch (error) {
      this.logger.warn(`Failed to refresh token for ${request.ip} - ${error.message}`, 'JwtAuthGuard')
      throw new UnauthorizedException('Token refresh failed.')
    }
  }
}
