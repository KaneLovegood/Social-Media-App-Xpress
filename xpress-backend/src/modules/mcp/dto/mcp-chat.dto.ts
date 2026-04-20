import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class McpChatDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;
}
