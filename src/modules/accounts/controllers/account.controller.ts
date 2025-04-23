/**
 * Resources
 */
import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'

/**
 * Dependencies
 */
import { RequirePermissions } from '@common/decorators/require-permissions.decorator'
import { UpdateAccountStatusDto } from '@modules/accounts/dto/requests/update-account-status.dto'
import { AccountResponseDto } from '@modules/accounts/dto/responses/account.response.dto'
import { AccountService } from '@modules/accounts/services/account.service'
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '@modules/auth/guards/permissions.guard'

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
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Patch(':id/status')
  @RequirePermissions(['ACCOUNT_ADMINISTRATION_OWN'], 'ACCOUNT_MANAGEMENT')
  @ApiOperation({ summary: 'Update account status', description: 'Activate or deactivate an account that the user has access to.' })
  @ApiParam({ name: 'id', description: 'Account ID', type: 'string' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiUnauthorizedResponse({ description: 'User does not have permission to manage the account' })
  async updateAccountStatus(@Req() req: AuthenticatedRequest, @Param('id') accountId: string, @Body() updateAccountStatusDto: UpdateAccountStatusDto): Promise<AccountResponseDto> {
    return this.accountService.updateAccountStatus(req.user.id, accountId, updateAccountStatusDto.isActive)
  }
}
