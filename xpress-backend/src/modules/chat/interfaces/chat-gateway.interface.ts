export interface IncomingCallPayload {
  senderId: string;
  senderName: string;
  callMode: 'voice' | 'video';
  sessionId: string;
  isOnline: boolean;
}

export interface JwtPayload {
  sub: string;
}

export interface TypingDto {
  receiverId: string;
  isTyping: boolean;
}

export interface ReceiveDto {
  messageId: string;
}

export interface ReadRoomDto {
  roomId: string;
}

export interface GroupCallStartDto {
  roomId: string;
  callMode: 'voice' | 'video';
}

export interface GroupCallSignalDto {
  roomId: string;
  receiverId: string;
  callMode: 'voice' | 'video';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface GroupCallEndDto {
  roomId: string;
  reason?: string;
}
