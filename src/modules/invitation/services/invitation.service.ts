/**
 * Resources
 */
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Locale, TokenType } from '@prisma/client'
import * as bcrypt from 'bcrypt'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { UserDefaults } from '@configs/db/user.config'
import { EnvConfig } from '@configs/env/services/env.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'
import { AuthService } from '@modules/auth/services/auth.service'
import { EmailService } from '@modules/email/services/email.service'

/**
 * DTO
 */
import { AcceptInvitationDto } from '@modules/invitation/dto/requests/accept-invitation.dto'
import { CreateInvitationDto } from '@modules/invitation/dto/requests/create-invitation.dto'
import { InvitationResponseDto } from '@modules/invitation/dto/responses/invitation.response.dto'

/**
 * Types
 */
import type { AuthTokens, TokenPayload } from '@modules/auth/services/auth.service'
import type { User } from '@prisma/client'

/**
 * Exports
 */
export interface InvitationTokenPayload extends TokenPayload {
  firstname?: string
  lastname?: string
  roleIds?: number[]
  accountIds?: string[]
  entityIds?: string[]
  locale?: Locale
}

/**
 * Declaration
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
    private readonly env: EnvConfig,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
    private readonly accountAccessService: AccountAccessService
  ) {}

  /**
   * Create an invitation for a new user
   */
  async createInvitation(inviterId: string, createInvitationDto: CreateInvitationDto): Promise<InvitationResponseDto> {
    const response: InvitationResponseDto = {
      message: 'Invitation sent successfully. The user will receive an email with instructions to join.'
    }

    const { email, firstname, lastname, roleIds, accountIds = [], entityIds = [], locale } = createInvitationDto

    this.logger.debug(`Creating invitation for ${email} by user ${inviterId}`, 'createInvitation')

    try {
      // Check if there is at least one account or entity ID
      if (accountIds.length === 0 && entityIds.length === 0) throw new BadRequestException('At least one account or entity ID must be provided')

      // Get inviter with their roles, permissions, accounts and entities in a single query
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        include: {
          people: true,
          rolesLinked: {
            include: {
              role: {
                include: {
                  permissionsLinked: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          },
          accountsLinked: {
            where: {
              account: {
                isActive: true
              }
            },
            include: {
              account: {
                include: {
                  entities: {
                    where: {
                      isActive: true
                    },
                    select: {
                      id: true,
                      accountId: true
                    }
                  }
                }
              }
            }
          },
          entitiesLinked: {
            where: {
              entity: {
                isActive: true
              }
            },
            include: {
              entity: {
                select: {
                  id: true,
                  accountId: true
                }
              }
            }
          }
        }
      })

      if (!inviter) throw new NotFoundException('Inviter user not found')

      // Extract user permissions
      const userPermissions = inviter.rolesLinked.flatMap((userRole) => userRole.role.permissionsLinked.map((permissionLink) => permissionLink.permission.name))

      // Remove duplicates
      const uniquePermissions = [...new Set(userPermissions)]

      // Check for required permissions based on invitation context
      const hasAccountInvitePermission = uniquePermissions.includes('USER_ACCOUNTS_INVITATION')
      const hasEntityInvitePermission = uniquePermissions.includes('USER_ENTITIES_INVITATION')
      const hasRoleAllocationPermission = uniquePermissions.includes('USER_ROLE_ALLOCATION')

      // Extract all accessible account IDs
      const accessibleAccountIds = inviter.accountsLinked.map((link) => link.account.id)

      // Extract all accessible entity IDs (both from direct links and from accounts)
      const entitiesFromAccounts = inviter.accountsLinked.flatMap((link) => link.account.entities.map((entity) => entity.id))
      const directlyLinkedEntities = inviter.entitiesLinked.map((link) => link.entity.id)
      const accessibleEntityIds = [...new Set([...entitiesFromAccounts, ...directlyLinkedEntities])]

      // Create a map of entity ID to account ID for access validation
      const entityAccountMap = new Map<string, string>()
      inviter.accountsLinked.forEach((link) => link.account.entities.forEach((entity) => entityAccountMap.set(entity.id, entity.accountId)))
      inviter.entitiesLinked.forEach((link) => {
        if (link.entity.accountId) entityAccountMap.set(link.entity.id, link.entity.accountId)
      })

      // Validate account IDs
      if (accountIds.length > 0) {
        // Check if user has account invitation permission
        if (!hasAccountInvitePermission) throw new UnauthorizedException('You do not have permission to invite users to accounts')

        // Verify that all provided account IDs are accessible
        const invalidAccountIds = accountIds.filter((id) => !accessibleAccountIds.includes(id))
        if (invalidAccountIds.length > 0) throw new UnauthorizedException(`You do not have access to these accounts: ${invalidAccountIds.join(', ')}`)
      }

      // Validate entity IDs
      if (entityIds.length > 0) {
        // Check if user has entity invitation permission
        if (!hasEntityInvitePermission) throw new UnauthorizedException('You do not have permission to invite users to entities')

        // Verify that all provided entity IDs are accessible
        const invalidEntityIds = entityIds.filter((id) => !accessibleEntityIds.includes(id))
        if (invalidEntityIds.length > 0) throw new UnauthorizedException(`You do not have access to these entities: ${invalidEntityIds.join(', ')}`)
      }

      // Check role assignment permission if roleIds are provided
      if (roleIds && roleIds.length > 0 && !hasRoleAllocationPermission) throw new UnauthorizedException('You do not have permission to assign roles')

      // Check if the email already exists
      const existingUser = await this.prisma.user.findUnique({ where: { email } })
      if (existingUser && existingUser.isActive) {
        // If the user is already active, don't create a new one, just return a success message
        this.logger.warn(`Invitation attempted for existing active user: ${email}`, 'createInvitation')
        return response
      }

      // Use existing user or create a new one if none exists
      let user: User

      if (existingUser) {
        // Re-using existing inactive user - just create a new invitation token
        this.logger.debug(`Re-inviting existing inactive user: ${email}`, 'createInvitation')
        user = existingUser
      } else {
        // Create a new inactive user
        user = await this.prisma.user.create({
          data: {
            email,
            password: '', // Will be set when the invitation is accepted
            isActive: false
          }
        })
      }

      // Generate the invitation token with all necessary information
      const invitationPayload: InvitationTokenPayload = {
        email: user.email,
        sub: user.id,
        firstname,
        lastname,
        roleIds,
        accountIds,
        entityIds,
        locale
      }

      const invitationToken = this.jwtService.sign(invitationPayload, {
        secret: this.env.get('JWT_SECRET_INVITATION'),
        expiresIn: this.env.get('JWT_INVITATION_EXPIRES_IN')
      })

      // Save the token in the database (will delete any existing tokens of the same type)
      await this.authService.createUniqueToken(user.id, invitationToken, TokenType.INVITATION, this.env.get('JWT_INVITATION_EXPIRES_IN'))

      // Return the token in development and test environments
      if (['development', 'test'].includes(this.env.get('NODE_ENV'))) {
        this.logger.debug(`Invitation token for ${email}: ${invitationToken}`, 'createInvitation')
        response.invitationToken = invitationToken
      }

      // Send the invitation email
      if (this.env.get('NODE_ENV') !== 'test') {
        const inviterName = inviter.people?.firstname ? `${inviter.people.firstname} ${inviter.people.lastname || ''}`.trim() : 'Un administrateur'
        await this.emailService.sendInvitationEmail(email, invitationToken, inviterName, firstname, locale || UserDefaults.preferences.locale)
      }

      return response
    } catch (error) {
      this.logger.error(`Failed to create invitation for ${email}: ${error.message}`, 'createInvitation')
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`Failed to create invitation: ${error.message}`)
    }
  }

  /**
   * Accept an invitation and complete the user setup
   */
  async acceptInvitation(acceptInvitationDto: AcceptInvitationDto): Promise<AuthTokens & { userId: string }> {
    const { invitationToken, password, firstname: userFirstname, lastname: userLastname, locale: userLocale } = acceptInvitationDto

    this.logger.debug('Accepting invitation', 'acceptInvitation')

    try {
      // Verify and decode the invitation token
      const payload = await this.verifyInvitationToken(invitationToken)

      // Verify that token contains at least one accountId or entityId
      if ((!payload.accountIds || payload.accountIds.length === 0) && (!payload.entityIds || payload.entityIds.length === 0)) {
        this.logger.warn(`Invalid invitation token: missing accountIds and entityIds`, 'acceptInvitation')
        throw new BadRequestException('The invitation token is invalid: it must contain at least one account or entity')
      }

      // Find the token in the database
      const tokenRecord = await this.prisma.userToken.findFirst({
        where: {
          userId: payload.sub,
          token: invitationToken,
          type: TokenType.INVITATION
        },
        include: {
          user: true
        }
      })

      if (!tokenRecord) throw new NotFoundException('Invalid or expired invitation token')

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Update the user password
      await this.prisma.user.update({
        where: { id: tokenRecord.user.id },
        data: { password: hashedPassword }
      })

      // Use user-provided values if available, otherwise fallback to token values
      const firstname = userFirstname || payload.firstname || ''
      const lastname = userLastname || payload.lastname || ''
      const locale = userLocale || payload.locale

      // Activate the user account with the information from the DTO and token
      await this.activateInvitedUserAccount(tokenRecord.user.id, tokenRecord.user.email, firstname, lastname, payload.accountIds || [], payload.entityIds || [], payload.roleIds || [], locale)

      // Delete the used token
      await this.prisma.userToken.delete({
        where: { id: tokenRecord.id }
      })

      // Generate authentication tokens
      const authTokens = await this.authService.generateTokens({
        id: tokenRecord.user.id,
        email: tokenRecord.user.email
      })

      return {
        ...authTokens,
        userId: tokenRecord.user.id
      }
    } catch (error) {
      this.logger.error(`Failed to accept invitation: ${error.message}`, 'acceptInvitation')
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`Failed to accept invitation: ${error.message}`)
    }
  }

  /**
   * Private methods
   */
  private async activateInvitedUserAccount(
    userId: string,
    email: string,
    firstname: string,
    lastname: string,
    accountIds: string[],
    entityIds: string[],
    roleIds: number[],
    locale?: Locale
  ): Promise<User> {
    try {
      this.logger.debug(`Activating account for invited user ${email}`, 'activateInvitedUserAccount')

      // At this point, we should have at least one account or entity ID
      // since we validate this in acceptInvitation
      if (accountIds.length === 0 && entityIds.length === 0) throw new BadRequestException('At least one account or entity ID must be provided')

      // Use the shared user profile activation method
      return await this.authService.createAndActivateUserProfile(userId, email, firstname, lastname, {
        accountIds,
        entityIds,
        roleIds,
        locale,
        createDefaultAccount: false // Important: do not create default account for invitations
      })
    } catch (error) {
      this.logger.error(`Failed to activate invited user account for ${email}: ${error.message}`, 'activateInvitedUserAccount')
      throw new BadRequestException(`Failed to activate user account: ${error.message}`)
    }
  }

  private async verifyInvitationToken(token: string): Promise<InvitationTokenPayload> {
    try {
      return this.jwtService.verify(token, {
        secret: this.env.get('JWT_SECRET_INVITATION')
      }) as InvitationTokenPayload
    } catch (error) {
      this.logger.warn(`Invalid invitation token: ${error.message}`, 'verifyInvitationToken')
      throw new UnauthorizedException('Invalid invitation token')
    }
  }
}
