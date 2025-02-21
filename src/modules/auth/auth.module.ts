/**
 * Resources
 */
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

/**
 * Dependencies
 */
import { EnvConfig } from '@configs/env/services/env.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
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
  providers: [AuthService, PrismaService],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
