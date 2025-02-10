/**
 * Resources
 */
import 'dotenv/config'
import chalk from 'chalk'
import { NestFactory } from '@nestjs/core'

/**
 * Dependencies
 */
import { AppModule } from './app.module'
import { Logger } from '@common/services/logger.service'
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter'

/**
 * Declaration
 */
const bootstrap = async () => {
  const app = await NestFactory.create(AppModule)
  const logger = app.get(Logger)

  app.useGlobalFilters(new GlobalExceptionFilter(logger))
  app.setGlobalPrefix(process.env.API_PREFIX ?? '/api')

  const port = process.env.PORT ?? 3000
  await app.listen(port)

  logger.log(chalk.green('✨ Application is running on: ') + chalk.yellow(`[http://localhost:${port}]`) + chalk.green(' ✨'))
}

bootstrap().catch((error) => {
  const logger = new Logger()
  logger.error('Failed to start application:', error, 'Bootstrap')
  process.exit(1)
})
