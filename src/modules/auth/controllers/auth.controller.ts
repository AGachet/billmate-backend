/**
 * Resources
 */
import { Controller, Post, Body, Req, Res } from '@nestjs/common'

/**
 * Dependencies
 */
import { AuthService } from '@modules/auth/services/auth.service'
import { SignOutDto } from '@modules/auth/dto/signout.dto'
import { SignInDto } from '@modules/auth/dto/signin.dto'

/**
 * Type
 */
import type { AuthTokens } from '@modules/auth/services/auth.service'
import type { Request, Response } from 'express'

/**
 * Declaration
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) response: Response): Promise<AuthTokens> {
    const tokens = await this.authService.signIn(signInDto)
    this.authService.setAuthCookies(response, tokens.accessToken, tokens.refreshToken)
    return tokens
  }

  @Post('signout')
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() signOutDto: SignOutDto) {
    const result = await this.authService.signOut(signOutDto.userId)
    this.authService.clearAuthCookies(response)
    return result
  }
}
