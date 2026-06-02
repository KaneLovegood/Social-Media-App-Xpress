import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyTwoFactorLoginDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @IsString()
  @Length(4, 4)
  code!: string;
}
