import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ManageGroupMemberDto {
  @IsUUID()
  targetUserId: string;
}

export class JoinGroupByInviteDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}

export class SetGroupNicknameDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;
}

export class PinGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;
}
