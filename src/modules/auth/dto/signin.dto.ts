/**
 * Resources
 */
import { IsEmail, IsString, MinLength, IsOptional, MaxLength } from 'class-validator'

/**
 * Declaration
 */
export class SignInDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(40, { message: 'Password must not exceed 40 characters' })
  password: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Token is too long' })
  confirmAccountToken?: string
}
