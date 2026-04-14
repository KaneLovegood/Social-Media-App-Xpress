import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}
