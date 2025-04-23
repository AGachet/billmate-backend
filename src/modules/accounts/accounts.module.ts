/**
 * Resources
 */
import { Module } from '@nestjs/common'

/**
 * Dependencies
 */
import { LoggerModule } from '@common/services/logger/logger.module'
import { PrismaModule } from '@configs/prisma/prisma.module'
import { AccountController } from '@modules/accounts/controllers/account.controller'
import { AccountService } from '@modules/accounts/services/account.service'

/**
 * Declaration
 */
@Module({
  imports: [LoggerModule, PrismaModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService]
})
export class AccountsModule {}
