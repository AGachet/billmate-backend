import { IsString, MinLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token received by email for password reset',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  resetPasswordToken: string

  @ApiProperty({
    description: 'New password (must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number)',
    example: 'NewPassword123',
    minLength: 8,
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$'
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
  })
  password: string

  @ApiProperty({
    description: 'Confirm the new password (must match password field)',
    example: 'NewPassword123',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  confirmPassword: string
}
