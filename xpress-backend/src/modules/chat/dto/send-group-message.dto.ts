import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';

export class SendGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE', 'VIDEO', 'CALL_LOG', 'SHARE_POST'])
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'CALL_LOG' | 'SHARE_POST';

  @IsOptional()
  @IsString()
  sharedPostId?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
