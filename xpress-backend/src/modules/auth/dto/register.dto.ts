import { IsEnum, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export enum UserRole {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Phone không hợp lệ' })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Password tối thiểu 8 ký tự' })
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
