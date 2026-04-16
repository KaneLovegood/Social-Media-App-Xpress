import { ChatActionName } from '../dto/chat-action.dto';
import { MessageEntity } from './message.interface';

export interface CallSignalBase {
  receiverId: string;
}

export interface CallOfferDto extends CallSignalBase {
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerDto extends CallSignalBase {
  answer: RTCSessionDescriptionInit;
}

export interface CallIceDto extends CallSignalBase {
  candidate: RTCIceCandidateInit;
}

export interface CallEndDto extends CallSignalBase {
  reason?: string;
}

export type CallMode = 'voice' | 'video';
export type CallState = 'ringing' | 'active' | 'declined' | 'ended';

export interface CallSession {
  sessionId: string;
  actionKey: string;
  orderId: string;
  initiatorUserId: string;
  peerUserId: string;
  actorUserId: string;
  mode: CallMode;
  state: CallState;
  startedAt: string;
  updatedAt: string;
  acceptedAt?: string;
  endedAt?: string;
}

export interface ChatActionResponse {
  success: true;
  action: ChatActionName;
  actorUserId: string;
  peerUserId: string;
  at: string;
  metadata: Record<string, unknown>;
  data: CallSession;
  callSummaryMessage?: MessageEntity;
}
