/**
 * Resources
 */
import { Controller, Post, Body, Res, Get, UseGuards, Req } from '@nestjs/common'

/**
 * Dependencies
 */
import { AuthService } from '@modules/auth/services/auth.service'
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard'

import { RequestPasswordResetDto } from '@modules/auth/dto/request-password-reset.dto'
import { ResetPasswordDto } from '@modules/auth/dto/reset-password.dto'
import { SignOutDto } from '@modules/auth/dto/signout.dto'
import { SignInDto } from '@modules/auth/dto/signin.dto'
import { SignUpDto } from '@modules/auth/dto/signup.dto'

/**
 * Type
 */
import type { SignInResponse, SignUpResponse, SignOutResponse, RequestPasswordResetResponse, ResetPasswordResponse, MeResponse } from '@modules/auth/services/auth.service'
import type { Response, Request } from 'express'
import type { User } from '@prisma/client'

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user: User
}

/**
 * Declaration
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<SignUpResponse> {
    return this.authService.signUp(signUpDto)
  }

  @Post('signin')
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) response: Response): Promise<SignInResponse> {
    const { accessToken, refreshToken, userId } = await this.authService.signIn(signInDto)
    this.authService.setAuthCookies(response, accessToken, refreshToken)
    return { userId }
  }

  @Post('signout')
  async signOut(@Res({ passthrough: true }) response: Response, @Body() signOutDto: SignOutDto): Promise<SignOutResponse> {
    const result = await this.authService.signOut(signOutDto)
    this.authService.clearAuthCookies(response)
    return result
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto): Promise<RequestPasswordResetResponse> {
    return this.authService.requestPasswordReset(requestPasswordResetDto)
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordDto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() request: AuthenticatedRequest): Promise<MeResponse> {
    return this.authService.getMe(request.user.id)
  }
}
