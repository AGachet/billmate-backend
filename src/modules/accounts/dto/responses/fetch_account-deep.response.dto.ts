import { ApiProperty } from '@nestjs/swagger'

export class PeopleDto {
  @ApiProperty({
    description: 'People ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string

  @ApiProperty({
    description: 'First name',
    example: 'John',
    nullable: true
  })
  firstname: string | null

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    nullable: true
  })
  lastname: string | null
}

export class OrganizationDto {
  @ApiProperty({
    description: 'Organization ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string

  @ApiProperty({
    description: 'Organization name',
    example: 'ACME Corporation'
  })
  name: string
}

export class EntityDto {
  @ApiProperty({
    description: 'Entity ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string

  @ApiProperty({
    description: 'Entity name',
    example: 'Finance Department'
  })
  name: string

  @ApiProperty({
    description: 'Entity description',
    example: 'Handles all financial operations',
    nullable: true
  })
  description: string | null

  @ApiProperty({
    description: 'Entity active status',
    example: true
  })
  isActive: boolean

  @ApiProperty({
    description: 'Organization information',
    type: OrganizationDto,
    nullable: true
  })
  organization: OrganizationDto | null
}

export class UserRoleDto {
  @ApiProperty({
    description: 'Role ID',
    example: 1
  })
  id: number

  @ApiProperty({
    description: 'Role name',
    example: 'admin'
  })
  name: string
}

export class AccountUserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com'
  })
  email: string

  @ApiProperty({
    description: 'User active status',
    example: true
  })
  isActive: boolean

  @ApiProperty({
    description: 'User personal information',
    type: PeopleDto,
    nullable: true
  })
  people: PeopleDto | null

  @ApiProperty({
    description: 'User roles',
    type: [UserRoleDto]
  })
  roles: UserRoleDto[]

  @ApiProperty({
    description: 'List of entity IDs the user is attached to',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    isArray: true
  })
  entityIds: string[]
}

export class AccountRoleDto {
  @ApiProperty({
    description: 'Role ID',
    example: 1
  })
  id: number

  @ApiProperty({
    description: 'Role name',
    example: 'admin'
  })
  name: string

  @ApiProperty({
    description: 'Role active status',
    example: true
  })
  isActive: boolean

  @ApiProperty({
    description: 'Whether this role is global (not account-specific)',
    example: false
  })
  isGlobal: boolean
}

export class FetchAccountDeepResponseDto {
  @ApiProperty({
    description: 'Account ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string

  @ApiProperty({
    description: 'Account name',
    example: 'Main account'
  })
  name: string

  @ApiProperty({
    description: 'Account description',
    example: 'This is the main account for managing finances',
    nullable: true
  })
  description: string | null

  @ApiProperty({
    description: 'Account active status',
    example: true
  })
  isActive: boolean

  @ApiProperty({
    description: 'Users linked to this account',
    type: [AccountUserDto]
  })
  users: AccountUserDto[]

  @ApiProperty({
    description: 'Entities linked to this account',
    type: [EntityDto]
  })
  entities: EntityDto[]

  @ApiProperty({
    description: 'Roles available for this account',
    type: [AccountRoleDto]
  })
  roles: AccountRoleDto[]

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-03-06T12:00:00.000Z'
  })
  createdAt: Date

  @ApiProperty({
    description: 'Account last update date',
    example: '2024-03-06T12:00:00.000Z'
  })
  updatedAt: Date
}
