/**
 * Resources
 */
import 'dotenv/config'
import chalk from 'chalk'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'

/**
 * Dependencies
 */
import { AppModule } from './app.module'
import { EnvConfig } from '@configs/env/env.config'
import { Logger } from '@common/services/logger.service'
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter'

/**
 * Declaration
 */
const bootstrap = async () => {
  const env = EnvConfig.getInstance()
  const app = await NestFactory.create(AppModule)
  const logger = app.get(Logger)

  app.setGlobalPrefix(env.get('API_PREFIX'))
  app.useGlobalFilters(new GlobalExceptionFilter(logger))
  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  await app.listen(env.get('PORT'))

  logger.log(chalk.green('✨ Application is running on: ') + chalk.yellow(`[http://localhost:${env.get('PORT')}]`) + chalk.green(' ✨'))
}

bootstrap().catch((error) => {
  const logger = new Logger()
  logger.error('Failed to start application:', error, 'Bootstrap')
  process.exit(1)
})
