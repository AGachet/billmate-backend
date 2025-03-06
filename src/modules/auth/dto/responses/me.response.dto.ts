import { ApiProperty } from '@nestjs/swagger'

export class MeResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  userId: string

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    nullable: true
  })
  firstname: string | null

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    nullable: true
  })
  lastname: string | null

  @ApiProperty({
    description: 'User roles',
    example: ['USER'],
    isArray: true
  })
  roles: string[]

  @ApiProperty({
    description: 'Accessible modules for the user',
    example: ['INVOICES', 'CLIENTS'],
    isArray: true
  })
  modules: string[]

  @ApiProperty({
    description: 'User permissions',
    example: ['READ', 'WRITE'],
    isArray: true
  })
  permissions: string[]

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-03-06T12:00:00.000Z',
    type: Date
  })
  createdAt: Date
}
