/**
 * Resources
 */
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Injectable, Logger } from '@nestjs/common'
import { OpenAPIObject } from '@nestjs/swagger'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { INestApplication } from '@nestjs/common'
import { openApiConfig } from '../configs/open-api.config'

/**
 * Declaration
 */
@Injectable()
export class ApiDocsService {
  private document: OpenAPIObject | null = null
  private readonly logger = new Logger(ApiDocsService.name)

  /**
   * Generates the OpenAPI documentation for the application
   * @param app The NestJS application instance
   * @returns The OpenAPI document containing all API routes and schemas
   */
  generateDocumentation(app: INestApplication): OpenAPIObject {
    this.logger.log('Generating OpenAPI documentation...')

    try {
      const config = new DocumentBuilder()
        .setTitle(openApiConfig.title)
        .setDescription(openApiConfig.description)
        .setVersion(openApiConfig.version)
        .setContact(openApiConfig.contact.name, openApiConfig.contact.url, openApiConfig.contact.email)
        .setLicense(openApiConfig.license.name, openApiConfig.license.url)
        .addBearerAuth()
        .build()

      this.document = SwaggerModule.createDocument(app, config)

      // Create docs directory at project root
      const docsPath = join(process.cwd(), 'docs')
      const apiDocsPath = join(process.cwd(), openApiConfig.outputPath)

      // Ensure directory exists
      if (!existsSync(docsPath)) {
        this.logger.log(`Creating directory: ${docsPath}`)
        mkdirSync(docsPath, { recursive: true })
      }

      // Write openapi.json file
      writeFileSync(apiDocsPath, JSON.stringify(this.document, null, 2))
      this.logger.log(`OpenAPI documentation generated and saved to: ${apiDocsPath}`)

      return this.document
    } catch (error) {
      this.logger.error(`Failed to generate OpenAPI documentation: ${error.message}`)
      throw error
    }
  }

  // Returns the current OpenAPI document
  getDocument(): OpenAPIObject {
    if (!this.document) {
      this.logger.warn('OpenAPI documentation requested but not yet generated')
      throw new Error('OpenAPI documentation not generated. Call generateDocumentation() first.')
    }
    return this.document
  }

  // Checks if the OpenAPI document has been generated
  isDocumentGenerated(): boolean {
    return this.document !== null
  }
}
