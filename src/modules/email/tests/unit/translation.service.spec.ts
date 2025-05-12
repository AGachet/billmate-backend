/**
 * Resources
 */
import { Locale } from '@prisma/client'

/**
 * Dependencies
 */
import { TranslationService } from '@modules/email/services/translation.service'

/**
 * Test utilities and mocks
 */
import { clearAllMocks, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Test suite
 */
describe('TranslationService', () => {
  let service: TranslationService

  beforeEach(async () => {
    clearAllMocks()

    const module = await createTestingModule([TranslationService])
    service = module.get<TranslationService>(TranslationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getTranslation', () => {
    describe('for English locale', () => {
      it('should return English translations when locale is EN', () => {
        // Act
        const result = service.getTranslation(Locale.EN, 'accountConfirmation')

        // Assert
        expect(result).toBeDefined()
        expect(result.subject).toBeDefined()
        expect(result.title).toBeDefined()
        expect(result.body).toBeDefined()
        expect(result.button).toBeDefined()
        expect(result.fallback).toBeDefined()
        expect(result.ignore).toBeDefined()
        expect(result.footer).toBeDefined()
        expect(result.greeting).toBeDefined()
      })
    })

    describe('for French locale', () => {
      it('should return French translations when locale is FR', () => {
        // Act
        const result = service.getTranslation(Locale.FR, 'accountConfirmation')

        // Assert
        expect(result).toBeDefined()
        expect(result.subject).toBeDefined()
        expect(result.title).toBeDefined()
        expect(result.body).toBeDefined()
        expect(result.button).toBeDefined()
        expect(result.fallback).toBeDefined()
        expect(result.ignore).toBeDefined()
        expect(result.footer).toBeDefined()
        expect(result.greeting).toBeDefined()
      })
    })

    describe('for unknown locale', () => {
      it('should return English translations as fallback for unknown locale', () => {
        // Act
        const result = service.getTranslation('unknown' as Locale, 'accountConfirmation')

        // Assert
        expect(result).toBeDefined()
        expect(result.subject).toBeDefined()
        expect(result.title).toBeDefined()
        expect(result.body).toBeDefined()
        expect(result.button).toBeDefined()
        expect(result.fallback).toBeDefined()
        expect(result.ignore).toBeDefined()
        expect(result.footer).toBeDefined()
        expect(result.greeting).toBeDefined()
      })
    })

    describe('password reset template', () => {
      it('should return password reset template with expiration field', () => {
        // Act
        const result = service.getTranslation(Locale.EN, 'passwordReset')

        // Assert
        expect(result).toBeDefined()
        expect(result.subject).toBeDefined()
        expect(result.title).toBeDefined()
        expect(result.body).toBeDefined()
        expect(result.button).toBeDefined()
        expect(result.fallback).toBeDefined()
        expect(result.ignore).toBeDefined()
        expect(result.footer).toBeDefined()
        expect(result.expiration).toBeDefined()
        expect(result.greeting).toBeDefined()
      })
    })

    describe('error handling', () => {
      it('should return undefined for invalid translation key', () => {
        // Act
        // @ts-expect-error - Testing invalid key
        const result = service.getTranslation(Locale.EN, 'invalidKey')

        // Assert
        expect(result).toBeUndefined()
      })
    })
  })
})
