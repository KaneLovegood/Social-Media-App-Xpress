import { IsIn, IsInt, IsNotEmpty, IsString, Max } from 'class-validator';

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(
    [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
    {
      message: 'Định dạng tệp không được hỗ trợ',
    },
  )
  contentType: string;

  @IsInt()
  @Max(10 * 1024 * 1024, {
    message: 'Kích thước tệp không được vượt quá 10MB',
  })
  fileSize: number;
}
