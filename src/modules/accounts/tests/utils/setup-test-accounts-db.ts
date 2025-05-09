/**
 * Utility for setting up test data for E2E account tests
 */
import { PrismaService } from '@configs/prisma/services/prisma.service'
import * as bcrypt from 'bcrypt'

/**
 * Result of the test accounts setup
 */
export interface TestAccountsSetup {
  /** User used for testing */
  userId: string
  /** Second user for testing */
  user2: {
    id: string
    email: string
  }
  /** First account for testing */
  account1: {
    id: string
    name: string
    description: string
    isActive: boolean
  }
  /** Second account for testing */
  account2: {
    id: string
    name: string
    description: string
    isActive: boolean
  }
}

/**
 * Set up test accounts for E2E testing
 * This function finds or creates the test user and associated accounts
 */
export async function setupTestAccounts(prisma: PrismaService): Promise<TestAccountsSetup> {
  // Try to find the Account Manager user
  const accountManager = await prisma.user.findUnique({
    where: { email: 'accounttest@billmate.test' },
    include: {
      accountsLinked: {
        include: {
          account: true
        }
      }
    }
  })

  // Option 1: If the user doesn't exist, create the user and accounts manually
  if (!accountManager) {
    // Create a test user manually with the necessary relationships
    try {
      // First check for required roles
      const userRole = await prisma.role.findFirst({ where: { name: 'user' } })
      const adminRole = await prisma.role.findFirst({ where: { name: 'account_administrator' } })

      if (!userRole || !adminRole) {
        throw new Error('Required roles not found. Check the database configuration.')
      }

      // Create People record
      const people = await prisma.people.create({
        data: {
          firstname: 'Account',
          lastname: 'Manager',
          email: 'accounttest@billmate.test'
        }
      })

      // Hashed password (TestPassword123)
      const hashedPassword = await bcrypt.hash('TestPassword123', 10)

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email: 'accounttest@billmate.test',
          password: hashedPassword,
          isActive: true,
          peopleId: people.id,
          preference: {
            create: {
              locale: 'FR'
            }
          },
          rolesLinked: {
            create: [{ roleId: userRole.id }, { roleId: adminRole.id }]
          }
        }
      })

      // Create account 1
      const account1 = await prisma.account.create({
        data: {
          name: 'Test Account 1',
          description: 'Account for testing status updates',
          isActive: true, // First account initially active
          usersLinked: {
            create: {
              userId: newUser.id
            }
          }
        }
      })

      // Create account 2
      const account2 = await prisma.account.create({
        data: {
          name: 'Test Account 2',
          description: 'Account for testing status updates',
          isActive: false, // Second account initially inactive
          usersLinked: {
            create: {
              userId: newUser.id
            }
          }
        }
      })

      // Create second test user
      const people2 = await prisma.people.create({
        data: {
          firstname: 'Test',
          lastname: 'User',
          email: 'testuser@billmate.test'
        }
      })

      const hashedPassword2 = await bcrypt.hash('TestPassword123', 10)
      const user2 = await prisma.user.create({
        data: {
          email: 'testuser@billmate.test',
          password: hashedPassword2,
          isActive: true,
          peopleId: people2.id,
          preference: {
            create: {
              locale: 'FR'
            }
          },
          rolesLinked: {
            create: [{ roleId: userRole.id }]
          }
        }
      })

      return {
        userId: newUser.id,
        user2: {
          id: user2.id,
          email: user2.email
        },
        account1: {
          id: account1.id,
          name: account1.name || 'Test Account 1',
          description: account1.description || 'Account for testing status updates',
          isActive: account1.isActive
        },
        account2: {
          id: account2.id,
          name: account2.name || 'Test Account 2',
          description: account2.description || 'Account for testing status updates',
          isActive: account2.isActive
        }
      }
    } catch (error) {
      console.error('Error creating test data:', error)
      throw error
    }
  } else {
    // Option 2: If the user exists, use the existing accounts
    // Take the first two accounts, regardless of their state
    if (accountManager.accountsLinked.length < 2) {
      throw new Error('User must have at least two accounts for testing')
    }

    const account1 = accountManager.accountsLinked[0].account
    const account2 = accountManager.accountsLinked[1].account

    return {
      userId: accountManager.id,
      user2: {
        id: accountManager.id, // Reuse the same user for simplicity in existing setup
        email: accountManager.email
      },
      account1: {
        id: account1.id,
        name: account1.name || 'Test Account 1',
        description: account1.description || 'Account for testing status updates',
        isActive: account1.isActive
      },
      account2: {
        id: account2.id,
        name: account2.name || 'Test Account 2',
        description: account2.description || 'Account for testing status updates',
        isActive: account2.isActive
      }
    }
  }
}

/**
 * Log in as the test user
 * @param agent The supertest agent to use for login
 * @param baseUrl The API base URL
 */
export async function loginTestUser(agent: ReturnType<typeof import('supertest').agent>, baseUrl: string = '/api'): Promise<void> {
  try {
    const response = await agent.post(`${baseUrl}/auth/signin`).send({
      email: 'accounttest@billmate.test',
      password: 'TestPassword123'
    })

    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status}`)
    }
  } catch (error) {
    console.error('Error during login:', error)
    throw error
  }
}
