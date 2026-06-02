import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorSetupDto {
  @IsString()
  @Length(4, 4)
  code!: string;
}
