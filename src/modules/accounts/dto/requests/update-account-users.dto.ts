/**
 * Resources
 */
import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator'

/**
 * Declaration
 */
export class UpdateAccountUsersDto {
  @ApiProperty({
    description: 'List of user IDs to associate with the account',
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', '3fa85f64-5717-4562-b3fc-2c963f66afa7'],
    type: [String]
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds: string[]
}
