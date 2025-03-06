/**
 * Resources
 */
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * Declaration
 */
export class SignUpDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
    minLength: 1
  })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  firstname: string

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Doe',
    minLength: 1
  })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  lastname: string

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string

  @ApiProperty({
    description: 'User password',
    example: 'mySecurePassword123',
    minLength: 6,
    maxLength: 40
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(40, { message: 'Password must not exceed 40 characters' })
  password: string
}
