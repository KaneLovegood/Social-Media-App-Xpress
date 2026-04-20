import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'email không hợp lệ' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  otpToken!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}