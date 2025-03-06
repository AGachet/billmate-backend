/**
 * Resources
 */
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import chalk from 'chalk'
import 'dotenv/config'

/**
 * Dependencies
 */
import { AppModule } from './app.module'
import { EnvConfig } from '@configs/env/services/env.service'
import { Logger } from '@common/services/logger/logger.service'
import { setupOpenApi } from '@configs/open-api/services/open-api'
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter'

/**
 * Declaration
 */
const bootstrap = async () => {
  const app = await NestFactory.create(AppModule)
  const env = app.get(EnvConfig)
  const logger = app.get(Logger)

  app.setGlobalPrefix(env.get('API_PREFIX'))
  app.useGlobalFilters(new GlobalExceptionFilter(logger))
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  app.use(cookieParser())

  // Setup Swagger/OpenAPI for documentation
  if (env.get('NODE_ENV') === 'development') setupOpenApi(app)

  await app.listen(env.get('PORT'))

  logger.log(chalk.green('✨ Application is running on: ') + chalk.yellow(`[http://localhost:${env.get('PORT')}]`) + chalk.green(' ✨'))

  if (env.get('NODE_ENV') === 'development') {
    logger.log(chalk.green('📚 API Documentation available at: ') + chalk.yellow(`[http://localhost:${env.get('PORT')}/api/docs]`) + chalk.green(' 📚'))
  }
}

bootstrap().catch((error) => {
  console.error(`Failed to start application: ${error}`)
  process.exit(1)
})
