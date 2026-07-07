import { IsEmail, IsIn, IsOptional } from 'class-validator';

const OTP_PURPOSES = ['REGISTER', 'LOGIN', 'CHANGE_PASSWORD'] as const;

export class SendEmailOtpDto {
  @IsEmail({}, { message: 'email không hợp lệ' })
  email!: string;

  @IsOptional()
  @IsIn(OTP_PURPOSES)
  purpose?: 'REGISTER' | 'LOGIN' | 'CHANGE_PASSWORD';
}
