/**
 * Resources
 */
import { IsString, IsNotEmpty } from 'class-validator'

/**
 * Declaration
 */
export class SignOutDto {
  @IsString()
  @IsNotEmpty()
  userId: string
}
