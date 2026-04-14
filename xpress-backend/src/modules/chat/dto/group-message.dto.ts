import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class GroupSendMessageDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

export class GroupReplyMessageDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  replyToMessageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

export class GroupDeleteMessageDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  messageId: string;
}

export class GroupRecallMessageDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  messageId: string;
}

export class GroupTypingDto {
  @IsUUID()
  groupId: string;

  @IsBoolean()
  isTyping: boolean;
}
