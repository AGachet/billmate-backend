/**
 * Resources
 */
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

/**
 * Dependencies
 */
import { EnvModule } from '@configs/env/env.module'
import { EnvConfig } from '@configs/env/services/env.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { AuthModule } from '@modules/auth/auth.module'
import { EmailModule } from '@modules/email/email.module'
import { InvitationController } from '@modules/invitation/controllers/invitation.controller'
import { InvitationService } from '@modules/invitation/services/invitation.service'

/**
 * Declaration
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [EnvModule],
      useFactory: (env: EnvConfig) => ({
        secret: env.get('JWT_SECRET_INVITATION'),
        signOptions: {
          expiresIn: env.get('JWT_INVITATION_EXPIRES_IN')
        }
      }),
      inject: [EnvConfig]
    }),
    EmailModule,
    AuthModule
  ],
  providers: [InvitationService, PrismaService],
  controllers: [InvitationController]
})
export class InvitationModule {}
