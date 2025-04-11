/**
 * Resources
 */
import { EnvConfig } from '@configs/env/services/env.service'
import { Module } from '@nestjs/common'

/**
 * Services
 */
import { EmailService } from '@modules/email/services/email.service'
import { MailerSendService } from '@modules/email/services/mailersend.service'
import { TranslationService } from '@modules/email/services/translation.service'

/**
 * Declaration
 */
@Module({
  providers: [MailerSendService, EmailService, EnvConfig, TranslationService],
  exports: [EmailService]
})
export class EmailModule {}
