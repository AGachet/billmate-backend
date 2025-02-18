/**
 * Resources
 */
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'

/**
 * Dependencies
 */
import { HealthModule } from '@modules/health/health.module'
import { PrismaModule } from '@configs/prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { EnvModule } from '@configs/env/env.module'
import { LoggerModule } from '@common/services/logger/logger.module'
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter'

/**
 * Declaration
 */
@Module({
  imports: [HealthModule, PrismaModule, AuthModule, LoggerModule, EnvModule],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    }
  ],
  exports: []
})
export class AppModule {}
