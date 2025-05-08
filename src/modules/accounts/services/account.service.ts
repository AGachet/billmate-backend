/**
 * Resources
 */
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'

/**
 * Dependencies
 */
import { AccountAccessService } from '@common/services/account-access/account-access.service'
import { Logger } from '@common/services/logger/logger.service'
import { PrismaService } from '@configs/prisma/services/prisma.service'

/**
 * DTO
 */
import { FetchAccountDeepResponseDto } from '@modules/accounts/dto/responses/fetch_account-deep.response.dto'
import { UpdateAccountStatusResponseDto } from '@modules/accounts/dto/responses/update-account-status.response.dto'
import { UpdateAccountUsersResponseDto } from '@modules/accounts/dto/responses/update-account-users.response.dto'

/**
 * Declaration
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly accountAccessService: AccountAccessService
  ) {}

  /**
   * Fetch account deep details (users, entities and roles)
   */
  async fetchAccountDeep(userId: string, accountId: string): Promise<FetchAccountDeepResponseDto> {
    this.logger.debug(`Getting detailed information for account ${accountId}`, 'getAccountDetails')

    try {
      // Verify that the user has access to the account
      await this.accountAccessService.validateUserAccountAccess(userId, accountId, 'getAccountDetails')

      // Get account information
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        include: {
          // Get all users linked to this account with their roles
          usersLinked: {
            include: {
              user: {
                include: {
                  people: true,
                  rolesLinked: {
                    include: {
                      role: true
                    }
                  },
                  entitiesLinked: {
                    include: {
                      entity: {
                        include: {
                          organization: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          // Get all entities for this account
          entities: {
            include: {
              organization: true
            }
          },
          // Get all roles associated with this account
          roles: true
        }
      })

      if (!account) throw new NotFoundException(`Account with ID ${accountId} not found`)

      // Process users data
      const users = account.usersLinked.map((link) => {
        // Get all entities this user is linked to
        const userEntityIds = link.user.entitiesLinked.filter((entityLink) => account.entities.some((entity) => entity.id === entityLink.entity.id)).map((entityLink) => entityLink.entity.id)

        return {
          id: link.user.id,
          email: link.user.email,
          isActive: link.user.isActive,
          people: link.user.people
            ? {
                id: link.user.people.id,
                firstname: link.user.people.firstname,
                lastname: link.user.people.lastname
              }
            : null,
          roles: link.user.rolesLinked.map((roleLink) => ({
            id: roleLink.role.id,
            name: roleLink.role.name
          })),
          entityIds: userEntityIds
        }
      })

      // Process entities data
      const entities = account.entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        description: entity.description,
        isActive: entity.isActive,
        organization: entity.organization
          ? {
              id: entity.organization.id,
              name: entity.organization.name
            }
          : null
      }))

      // Process roles data - combine account-specific and global roles
      const accountRoles = account.roles.map((role) => ({
        id: role.id,
        name: role.name,
        isActive: role.isActive,
        isGlobal: false
      }))

      // Get all system roles (not account-specific)
      const systemRoles = await this.prisma.role.findMany({
        where: {
          accountId: null
        }
      })

      const systemRolesData = systemRoles.map((role) => ({
        id: role.id,
        name: role.name,
        isActive: role.isActive,
        isGlobal: true
      }))

      // Combine all roles, removing duplicates
      const allRoles = [...systemRolesData, ...accountRoles]
      const uniqueRolesMap: Record<number, (typeof allRoles)[0]> = {}

      allRoles.forEach((role) => {
        uniqueRolesMap[role.id] = role
      })

      const roles = Object.values(uniqueRolesMap)

      return {
        id: account.id,
        name: account.name,
        description: account.description,
        isActive: account.isActive,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        users,
        entities,
        roles
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) throw error
      this.logger.error(`Failed to get account details: ${error.message}`, 'getAccountDetails')
      throw new BadRequestException('Failed to get account details')
    }
  }

  /**
   * Update account status (activate/deactivate)
   */
  async updateAccountStatus(userId: string, accountId: string, isActive: boolean): Promise<UpdateAccountStatusResponseDto> {
    this.logger.debug(`Updating account ${accountId} status to ${isActive ? 'active' : 'inactive'} for user ${userId}`, 'updateAccountStatus')

    try {
      // Verify that the user has access to the account
      const userAccountLink = await this.accountAccessService.validateUserAccountAccess(userId, accountId, 'updateAccountStatus')

      // Check if the account is already in the desired state
      if (userAccountLink.account.isActive === isActive) {
        this.logger.debug(`Account ${accountId} is already ${isActive ? 'active' : 'inactive'}`, 'updateAccountStatus')
        return {
          id: userAccountLink.account.id,
          name: userAccountLink.account.name,
          isActive: userAccountLink.account.isActive
        }
      }

      // Update the account status
      const updatedAccount = await this.prisma.account.update({
        where: { id: accountId },
        data: { isActive }
      })

      return {
        id: updatedAccount.id,
        name: updatedAccount.name,
        isActive: updatedAccount.isActive
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      this.logger.error(`Failed to update account ${accountId} status to ${isActive ? 'active' : 'inactive'} for user ${userId}: ${error.message}`, 'updateAccountStatus')
      throw new BadRequestException(`Failed to ${isActive ? 'activate' : 'deactivate'} account`)
    }
  }

  /**
   * Manage users linked to an account
   */
  async updateAccountUsers(userId: string, accountId: string, userIds: string[]): Promise<UpdateAccountUsersResponseDto> {
    this.logger.debug(`Managing users for account ${accountId}`, 'updateAccountUsers')

    try {
      // Verify access
      await this.accountAccessService.validateUserAccountAccess(userId, accountId, 'updateAccountUsers')

      // Get account with active users and entities
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        include: {
          usersLinked: {
            include: {
              user: {
                include: {
                  people: true
                }
              }
            }
          },
          entities: {
            where: { isActive: true },
            include: {
              users: {
                where: { user: { isActive: true } },
                include: { user: true }
              }
            }
          }
        }
      })

      if (!account) throw new NotFoundException(`Account with ID ${accountId} not found`)

      // Calculate users to add and remove
      const currentUserIds = account.usersLinked.map((link) => link.userId)
      const usersToRemove = currentUserIds.filter((id) => !userIds.includes(id))
      const usersToAdd = userIds.filter((id) => !currentUserIds.includes(id))

      // Check if the account would have no active users after the update
      const remainingDirectUsers = currentUserIds.filter((id) => !usersToRemove.includes(id)).length
      const activeUsersInEntities = new Set()
      account.entities.forEach((entity) => {
        entity.users.forEach((userLink) => {
          activeUsersInEntities.add(userLink.user.id)
        })
      })

      if (remainingDirectUsers === 0 && activeUsersInEntities.size === 0) {
        throw new BadRequestException('Cannot update users as it would leave the account without any active users (directly or via active entities)')
      }

      // Update users
      await this.prisma.$transaction(async (prisma) => {
        // Remove users
        if (usersToRemove.length > 0) {
          await prisma.userAccountLink.deleteMany({
            where: {
              userId: { in: usersToRemove },
              accountId
            }
          })
        }

        // Add users
        if (usersToAdd.length > 0) {
          await prisma.userAccountLink.createMany({
            data: usersToAdd.map((userId) => ({
              userId,
              accountId
            }))
          })
        }
      })

      // Get updated users list
      const updatedUsers = await this.prisma.userAccountLink.findMany({
        where: { accountId },
        include: {
          user: {
            include: {
              people: true
            }
          }
        }
      })

      // Process users data
      const users = updatedUsers.map((link) => ({
        id: link.user.id,
        email: link.user.email,
        isActive: link.user.isActive,
        people: link.user.people
          ? {
              id: link.user.people.id,
              firstname: link.user.people.firstname,
              lastname: link.user.people.lastname
            }
          : null
      }))

      return {
        id: account.id,
        name: account.name,
        users
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof UnauthorizedException) throw error
      this.logger.error(`Failed to manage users for account ${accountId}: ${error.message}`, 'manageAccountUsers')
      throw new BadRequestException('Failed to update account users')
    }
  }
}
