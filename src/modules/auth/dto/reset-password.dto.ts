import { IsString, MinLength, Matches } from 'class-validator'

export class ResetPasswordDto {
  @IsString()
  resetPasswordToken: string

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
  })
  password: string

  @IsString()
  @MinLength(8)
  confirmPassword: string
}
