/**
 * Resources
 */
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'

/**
 * Dependencies
 */
import { RequirePermissions } from '@common/decorators/require-permissions.decorator'
import { AccountService } from '@modules/accounts/services/account.service'
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '@modules/auth/guards/permissions.guard'

/**
 * DTO
 */
import { UpdateAccountStatusDto } from '@modules/accounts/dto/requests/update-account-status.dto'
import { UpdateAccountUsersDto } from '@modules/accounts/dto/requests/update-account-users.dto'

import { FetchAccountDeepResponseDto } from '@modules/accounts/dto/responses/fetch_account-deep.response.dto'
import { UpdateAccountStatusResponseDto } from '@modules/accounts/dto/responses/update-account-status.response.dto'
import { UpdateAccountUsersResponseDto } from '@modules/accounts/dto/responses/update-account-users.response.dto'

/**
 * Type
 */
import type { User } from '@prisma/client'
import type { Request } from 'express'

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user: User
}

/**
 * Declaration
 */
@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get(':id')
  @RequirePermissions([], 'ACCOUNT_MANAGEMENT')
  @UseGuards(PermissionsGuard)
  /** Start -- Documentation */
  @ApiOperation({ summary: 'Fetch account details', description: 'Fetch detailed account information including users, entities, and roles.' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Detailed account information', type: FetchAccountDeepResponseDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 400, description: 'Failed to get account details' })
  /** End -- Documentation */
  async fetchAccountDeep(@Req() req: AuthenticatedRequest, @Param('id') accountId: string): Promise<FetchAccountDeepResponseDto> {
    return this.accountService.fetchAccountDeep(req.user.id, accountId)
  }

  @Patch(':id/status')
  @RequirePermissions(['ACCOUNT_ADMINISTRATION_OWN'], 'ACCOUNT_MANAGEMENT')
  @UseGuards(PermissionsGuard)
  /** Start -- Documentation */
  @ApiOperation({ summary: 'Update account status', description: 'Activate or deactivate an account that the user has access to.' })
  @ApiParam({ name: 'id', description: 'Account ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Account status updated successfully', type: UpdateAccountStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 400, description: 'Failed to update account status' })
  @ApiUnauthorizedResponse({ description: 'User does not have permission to manage the account' })
  /** End -- Documentation */
  async updateAccountStatus(@Req() req: AuthenticatedRequest, @Param('id') accountId: string, @Body() updateAccountStatusDto: UpdateAccountStatusDto): Promise<UpdateAccountStatusResponseDto> {
    return this.accountService.updateAccountStatus(req.user.id, accountId, updateAccountStatusDto.isActive)
  }

  @Patch(':id/users')
  @RequirePermissions(['ACCOUNT_USER_MANAGEMENT'], 'ACCOUNT_MANAGEMENT')
  @UseGuards(PermissionsGuard)
  /** Start -- Documentation */
  @ApiOperation({ summary: 'Update account users', description: 'Update the users linked to an account.' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'The users have been successfully updated for the account', type: UpdateAccountUsersResponseDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 400, description: 'Failed to update account users' })
  @ApiUnauthorizedResponse({ description: 'User does not have permission to manage the account' })
  /** End -- Documentation */
  async updateAccountUsers(@Req() req: AuthenticatedRequest, @Param('id') accountId: string, @Body() updateAccountUsersDto: UpdateAccountUsersDto): Promise<UpdateAccountUsersResponseDto> {
    return this.accountService.updateAccountUsers(req.user.id, accountId, updateAccountUsersDto.userIds)
  }
}
