import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @IsArray()
  @ArrayMinSize(2, {
    message: 'Nhom can it nhat 3 nguoi (bao gom ban va 2 thanh vien khac)',
  })
  @ArrayUnique()
  @IsString({ each: true })
  memberUserIds!: string[];
}
