import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GroupMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId: string;
}
