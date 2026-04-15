import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email không hợp lệ' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}
