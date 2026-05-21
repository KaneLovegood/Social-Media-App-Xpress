import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  noiDung?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  viTri?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  danhSachAnh?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  danhSachVideo?: string[];

  @IsOptional()
  @IsEnum(['public', 'friends', 'private'])
  cheDoRiengTu?: 'public' | 'friends' | 'private';
}
