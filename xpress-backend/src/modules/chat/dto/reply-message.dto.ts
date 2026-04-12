import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReplyMessageDto {
  @IsUUID()
  receiverId: string;

  @IsUUID()
  replyToMessageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}
