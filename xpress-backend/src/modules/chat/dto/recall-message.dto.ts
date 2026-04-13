import { IsUUID } from 'class-validator';

export class RecallMessageDto {
  @IsUUID()
  messageId: string;
}
