import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail({}, { message: 'email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
