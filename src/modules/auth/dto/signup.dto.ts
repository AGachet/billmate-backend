/**
 * Resources
 */
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

/**
 * Declaration
 */
export class SignUpDto {
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  firstname: string

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  lastname: string

  @IsEmail({}, { message: 'Invalid email format' })
  email: string

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(40, { message: 'Password must not exceed 40 characters' })
  password: string
}
