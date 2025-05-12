/**
 * Resources
 */
import { EnvConfig } from '@configs/env/services/env.service'
import { Locale } from '@prisma/client'

/**
 * Dependencies
 */
import { Logger } from '@common/services/logger/logger.service'
import { EmailService } from '@modules/email/services/email.service'
import { MailerSendService } from '@modules/email/services/mailersend.service'
import { TranslationService } from '@modules/email/services/translation.service'

/**
 * Test utilities and mocks
 */
import { mockEnvConfig, mockLogger } from '@common/tests/unit/mocks/service-mocks'
import { clearAllMocks, createTestingModule } from '@common/tests/unit/utils/test-utils'

/**
 * Test
 */
describe('EmailService', () => {
  let service: EmailService
  let mailerSendService: jest.Mocked<MailerSendService>
  let translationService: jest.Mocked<TranslationService>

  beforeEach(async () => {
    clearAllMocks()

    // Setup specific mocks for this test
    mailerSendService = {
      sendEmail: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<MailerSendService>

    translationService = {
      getTranslation: jest.fn().mockReturnValue({ subject: 'Test Subject' })
    } as unknown as jest.Mocked<TranslationService>

    const module = await createTestingModule([
      EmailService,
      {
        provide: MailerSendService,
        useValue: mailerSendService
      },
      {
        provide: Logger,
        useValue: mockLogger
      },
      {
        provide: TranslationService,
        useValue: translationService
      },
      {
        provide: EnvConfig,
        useValue: mockEnvConfig
      }
    ])

    service = module.get<EmailService>(EmailService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendAccountConfirmationEmail', () => {
    const email = 'test@example.com'
    const confirmationToken = 'test-token'
    const firstName = 'John'
    const locale = Locale.EN

    describe('when successful', () => {
      beforeEach(() => {
        mockEnvConfig.get.mockReturnValue('http://localhost:3000')
        translationService.getTranslation.mockReturnValue({
          subject: 'Account Confirmation',
          title: 'Welcome',
          body: 'Thank you for signing up',
          button: 'Confirm Account',
          fallback: 'Confirm your account',
          ignore: 'Ignore this email',
          footer: 'Footer',
          greeting: 'Hello'
        })
      })

      it('should send account confirmation email successfully', async () => {
        // Act
        await service.sendAccountConfirmationEmail(email, confirmationToken, firstName, locale)

        // Verify
        expect(mockEnvConfig.get).toHaveBeenCalledWith('FRONTEND_URL')
        expect(translationService.getTranslation).toHaveBeenCalledWith(locale, 'accountConfirmation')
        expect(mailerSendService.sendEmail).toHaveBeenCalled()
        expect(mockLogger.log).toHaveBeenCalledWith(`Account confirmation email sent successfully to ${email}`)
      })
    })

    describe('when errors occur', () => {
      beforeEach(() => {
        mockEnvConfig.get.mockReturnValue('http://localhost:3000')
        translationService.getTranslation.mockReturnValue({
          subject: 'Account Confirmation',
          title: 'Welcome',
          body: 'Thank you for signing up',
          button: 'Confirm Account',
          fallback: 'Confirm your account',
          ignore: 'Ignore this email',
          footer: 'Footer',
          greeting: 'Hello'
        })
        const error = new Error('Test error')
        mailerSendService.sendEmail.mockRejectedValueOnce(error)
      })

      it('should handle errors when sending account confirmation email', async () => {
        // Act & Assert
        await expect(service.sendAccountConfirmationEmail(email, confirmationToken, firstName)).rejects.toThrow('Failed to send account confirmation email: Test error')

        // Verify
        expect(mockLogger.error).toHaveBeenCalled()
      })
    })
  })

  describe('sendPasswordResetEmail', () => {
    const email = 'test@example.com'
    const resetToken = 'test-token'
    const firstName = 'John'
    const locale = Locale.EN

    describe('when successful', () => {
      beforeEach(() => {
        mockEnvConfig.get.mockReturnValue('http://localhost:3000')
        translationService.getTranslation.mockReturnValue({
          subject: 'Password Reset',
          title: 'Reset Your Password',
          body: 'You requested a password reset',
          button: 'Reset Password',
          fallback: 'Reset your password',
          ignore: 'Ignore this email',
          footer: 'Footer',
          expiration: 'This link will expire in 1 hour',
          greeting: 'Hello'
        })
      })

      it('should send password reset email successfully', async () => {
        // Act
        await service.sendPasswordResetEmail(email, resetToken, firstName, locale)

        // Verify
        expect(mockEnvConfig.get).toHaveBeenCalledWith('FRONTEND_URL')
        expect(translationService.getTranslation).toHaveBeenCalledWith(locale, 'passwordReset')
        expect(mailerSendService.sendEmail).toHaveBeenCalled()
        expect(mockLogger.log).toHaveBeenCalledWith(`Password reset email sent successfully to ${email}`)
      })
    })

    describe('when errors occur', () => {
      beforeEach(() => {
        mockEnvConfig.get.mockReturnValue('http://localhost:3000')
        translationService.getTranslation.mockReturnValue({
          subject: 'Password Reset',
          title: 'Reset Your Password',
          body: 'You requested a password reset',
          button: 'Reset Password',
          fallback: 'Reset your password',
          ignore: 'Ignore this email',
          footer: 'Footer',
          expiration: 'This link will expire in 1 hour',
          greeting: 'Hello'
        })
        const error = new Error('Test error')
        mailerSendService.sendEmail.mockRejectedValueOnce(error)
      })

      it('should handle errors when sending password reset email', async () => {
        // Act & Assert
        await expect(service.sendPasswordResetEmail(email, resetToken, firstName)).rejects.toThrow('Failed to send password reset email: Test error')

        // Verify
        expect(mockLogger.error).toHaveBeenCalled()
      })
    })
  })
})
