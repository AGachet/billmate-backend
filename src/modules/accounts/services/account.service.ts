/**
 * Resources
 */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'

/**
 * Type
 */
import type { AccountResponseDto } from '@modules/accounts/dto/responses/account.response.dto'

/**
 * Declaration
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger
  ) {}

  /**
   * Update account status (activate/deactivate)
   */
  async updateAccountStatus(userId: string, accountId: string, isActive: boolean): Promise<AccountResponseDto> {
    this.logger.debug(`Updating account ${accountId} status to ${isActive ? 'active' : 'inactive'} for user ${userId}`, 'updateAccountStatus')

    try {
      // Verify that the user has access to the account
      const userAccountLink = await this.prisma.userAccountLink.findUnique({
        where: {
          userId_accountId: {
            userId,
            accountId
          }
        },
        include: {
          account: true
        }
      })

      if (!userAccountLink) {
        this.logger.warn(`User ${userId} tried to access unauthorized account ${accountId}`, 'updateAccountStatus')
        throw new UnauthorizedException('You do not have access to this account')
      }

      // Check if the account is already in the desired state
      if (userAccountLink.account.isActive === isActive) {
        this.logger.debug(`Account ${accountId} is already ${isActive ? 'active' : 'inactive'}`, 'updateAccountStatus')
        return {
          id: userAccountLink.account.id,
          name: userAccountLink.account.name,
          description: userAccountLink.account.description,
          isActive: userAccountLink.account.isActive,
          createdAt: userAccountLink.account.createdAt,
          updatedAt: userAccountLink.account.updatedAt
        }
      }

      // Update the account status
      const updatedAccount = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          isActive
        }
      })

      return {
        id: updatedAccount.id,
        name: updatedAccount.name,
        description: updatedAccount.description,
        isActive: updatedAccount.isActive,
        createdAt: updatedAccount.createdAt,
        updatedAt: updatedAccount.updatedAt
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      this.logger.error(`Failed to update account ${accountId} status to ${isActive ? 'active' : 'inactive'} for user ${userId}: ${error.message}`, 'updateAccountStatus')
      throw new BadRequestException(`Failed to ${isActive ? 'activate' : 'deactivate'} account`)
    }
  }
}
