/**
 * Resources
 */
import { z } from 'zod'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger.service'

/**
 * Type
 */
export type EnvConfigType = z.infer<ReturnType<typeof EnvConfig.getSchema>>
import type { StringValue } from 'ms'

/**
 * Declaration
 */
export class EnvConfig {
  private readonly config: EnvConfigType
  private static readonly logger = new Logger()
  private static instance: EnvConfig | null = null
  private static readonly schema = z.object({
    // Server Configuration
    PORT: z.string().transform(Number).default('3500'),

    // Database Configuration
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),

    // API Configuration
    API_PREFIX: z.string().default('/api'),
    NODE_ENV: z.enum(['development', 'production', 'test']),

    // JWT Configuration
    JWT_AUTH_EXPIRES_IN: z.string().refine((val): val is StringValue => true),
    JWT_REFRESH_EXPIRES_IN: z.string().refine((val): val is StringValue => true),
    JWT_CREATE_ACCOUNT_EXPIRES_IN: z.string().refine((val): val is StringValue => true),
    JWT_RESET_PASSWORD_EXPIRES_IN: z.string().refine((val): val is StringValue => true),

    JWT_SECRET_AUTH: z.string().min(32),
    JWT_SECRET_REFRESH: z.string().min(32),
    JWT_SECRET_CONFIRM_ACCOUNT: z.string().min(32),
    JWT_SECRET_RESET_PASSWORD: z.string().min(32),

    // Log Configuration
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_DIR: z.string().min(1)
  })

  private constructor() {
    this.config = this.validate()
  }

  // Singleton pattern: returns the existing instance or creates a new one.
  static getInstance(): EnvConfig {
    if (!EnvConfig.instance) EnvConfig.instance = new EnvConfig()
    return EnvConfig.instance
  }

  // Validates and parses environment variables
  private validate() {
    try {
      return EnvConfig.schema.parse(process.env)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingVariables = error.errors.map((err) => err.path.join('.'))
        EnvConfig.logger.error(`Environment validation failed:\n${missingVariables.join('\n')}`)
        throw new Error(`Environment validation failed:\n${missingVariables.join('\n')}`)
      }
      throw error
    }
  }

  // Returns an environment variable by key
  get<K extends keyof EnvConfigType>(key: K): EnvConfigType[K] {
    return this.config[key]
  }

  static getSchema() {
    return this.schema
  }
}
