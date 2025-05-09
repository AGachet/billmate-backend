/**
 * Resources
 */
import { Module } from '@nestjs/common'

/**
 * Dependencies
 */
import { AccountController } from '@modules/accounts/controllers/account.controller'
import { AccountService } from '@modules/accounts/services/account.service'

/**
 * Declaration
 */
@Module({
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountsModule {}
