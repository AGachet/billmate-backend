/**
 * Resources
 */
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

/**
 * Dependencies
 */
import { EnvConfig } from '@configs/env/env.config'
import { Logger } from '@common/services/logger.service'
import { PrismaService } from '@configs/prisma/prisma.service'
import { AuthService } from '@modules/auth/services/auth.service'
import { AuthController } from '@modules/auth/controllers/auth.controller'

/**
 * Declaration
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [AuthModule],
      useFactory: (env: EnvConfig) => ({
        secret: env.get('JWT_SECRET_AUTH'),
        signOptions: {
          expiresIn: env.get('JWT_AUTH_EXPIRES_IN')
        }
      }),
      inject: [EnvConfig]
    })
  ],
  providers: [
    {
      provide: EnvConfig,
      useFactory: () => EnvConfig.getInstance()
    },
    AuthService,
    PrismaService,
    Logger
  ],
  controllers: [AuthController],
  exports: [AuthService, EnvConfig]
})
export class AuthModule {}
