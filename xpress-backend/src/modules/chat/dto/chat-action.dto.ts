import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export const chatActionValues = [
  'open_voice_call',
  'open_video_call',
  'accept_call',
  'decline_call',
  'end_call',
] as const;

export type ChatActionName = (typeof chatActionValues)[number];

export class ChatActionDto {
  @IsIn(chatActionValues)
  action: ChatActionName;

  @IsString()
  @IsNotEmpty()
  peerUserId: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
