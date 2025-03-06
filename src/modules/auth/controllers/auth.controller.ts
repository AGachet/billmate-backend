/**
 * Resources
 */
import { Controller, Post, Body, Res, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiBadRequestResponse } from '@nestjs/swagger'

/**
 * Dependencies
 */
import { AuthService } from '@modules/auth/services/auth.service'
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard'

import { RequestPasswordResetDto } from '@modules/auth/dto/requests/request-password-reset.dto'
import { ResetPasswordDto } from '@modules/auth/dto/requests/reset-password.dto'
import { SignOutDto } from '@modules/auth/dto/requests/signout.dto'
import { SignInDto } from '@modules/auth/dto/requests/signin.dto'
import { SignUpDto } from '@modules/auth/dto/requests/signup.dto'

import { RequestPasswordResetResponseDto } from '@modules/auth/dto/responses/request-password-reset.response.dto'
import { ResetPasswordResponseDto } from '@modules/auth/dto/responses/reset-password.response.dto'
import { SignOutResponseDto } from '@modules/auth/dto/responses/signout.response.dto'
import { SignInResponseDto } from '@modules/auth/dto/responses/signin.response.dto'
import { SignUpResponseDto } from '@modules/auth/dto/responses/signup.response.dto'
import { MeResponseDto } from '@modules/auth/dto/responses/me.response.dto'

/**
 * Type
 */
import type { Response, Request } from 'express'
import type { User } from '@prisma/client'

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user: User
}

/**
 * Declaration
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account. A confirmation email will be sent if the email address is valid.'
  })
  @ApiOkResponse({
    type: SignUpResponseDto,
    description: 'Registration request processed. If the email is valid, a confirmation email will be sent.'
  })
  async signUp(@Body() signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    return this.authService.signUp(signUpDto)
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login', description: 'Authenticate user and return access token.' })
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) response: Response): Promise<SignInResponseDto> {
    const { accessToken, refreshToken, userId } = await this.authService.signIn(signInDto)
    this.authService.setAuthCookies(response, accessToken, refreshToken)
    return { userId }
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout', description: 'Invalidate user session and clear authentication tokens.' })
  @ApiOkResponse({ type: SignOutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token.' })
  async signOut(@Res({ passthrough: true }) response: Response, @Body() signOutDto: SignOutDto): Promise<SignOutResponseDto> {
    const result = await this.authService.signOut(signOutDto)
    this.authService.clearAuthCookies(response)
    return result
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Request a password reset. If the email is valid and the account has the necessary permissions, a reset email will be sent.'
  })
  @ApiOkResponse({
    type: RequestPasswordResetResponseDto,
    description: 'Request processed. If the email is valid and has permission to reset password, reset instructions will be sent.'
  })
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto): Promise<RequestPasswordResetResponseDto> {
    return this.authService.requestPasswordReset(requestPasswordResetDto)
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password', description: 'Reset user password using the token received by email.' })
  @ApiOkResponse({ type: ResetPasswordResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired token.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(resetPasswordDto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user', description: 'Retrieve the profile of the currently authenticated user.' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token.' })
  async getMe(@Req() request: AuthenticatedRequest): Promise<MeResponseDto> {
    return this.authService.getMe(request.user.id)
  }
}
