import { ApiProperty } from '@nestjs/swagger'

export class AccountResponseDto {
  @ApiProperty({
    description: 'Account unique identifier',
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
    required: false,
    nullable: true
  })
  description: string | null

  @ApiProperty({
    description: 'Whether the account is active',
    example: true
  })
  isActive: boolean

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-03-06T12:00:00.000Z',
    type: Date
  })
  createdAt: Date

  @ApiProperty({
    description: 'Account last update date',
    example: '2024-03-06T12:00:00.000Z',
    type: Date
  })
  updatedAt: Date
}
