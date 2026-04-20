import {
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  receiverId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE', 'VIDEO', 'CALL_LOG'])
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'CALL_LOG';

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
