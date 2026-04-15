import { IsEmail, IsIn, IsString, Length } from 'class-validator';

const OTP_PURPOSES = ['REGISTER', 'LOGIN'] as const;

export class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'email không hợp lệ' })
  email: string;

  @IsString()
  @Length(4, 4)
  code: string;

  @IsIn(OTP_PURPOSES)
  purpose: 'REGISTER' | 'LOGIN';
}
