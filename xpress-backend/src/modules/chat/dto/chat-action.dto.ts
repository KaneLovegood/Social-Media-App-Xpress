import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export const chatActionValues = [
  'open_voice_call',
  'open_video_call',
  'accept_call',
  'decline_call',
  'end_call',
  'call_driver',
  'view_order',
  'view_receipt',
  'contact_support',
] as const;

export type ChatActionName = (typeof chatActionValues)[number];

export class ChatActionDto {
  @IsIn(chatActionValues)
  action: ChatActionName;

  @IsString()
  @IsNotEmpty()
  peerUserId: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
