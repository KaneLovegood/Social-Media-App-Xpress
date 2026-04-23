import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: 'Avatar URL không hợp lệ',
    },
  )
  avatarUrl: string;
}
