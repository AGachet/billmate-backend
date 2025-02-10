/**
 * Resources
 */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'

/**
 * Dependencies
 */
import { Logger } from '../services/logger.service'

/**
 * Declaration
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error'

    this.logger.error(
      `Error occurred: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
      exception instanceof Error && exception.stack ? exception.stack : 'No stack trace available',
      'GlobalExceptionFilter'
    )

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message
    })
  }
}
