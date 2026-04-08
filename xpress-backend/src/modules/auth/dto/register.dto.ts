import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^(0|\+84)[0-9]{9,10}$/, { message: 'phone không hợp lệ' })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;
}
