import { ChatMessage } from '@/lib/realtime/types';

export function getClearHistoryStorageKey(userId: string): string {
  return `xpress.chat.cleared.${userId}`;
}

export function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

export function toAgeLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp).getTime();
  if (Number.isNaN(at)) return 'vài giây trước';

  const deltaMs = Math.max(0, Date.now() - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return 'vài giây trước';
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)} phút trước`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)} giờ trước`;
  return `${Math.floor(deltaMs / day)} ngày trước`;
}

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((first, second) => {
    const timeDiff = first.createdAt.localeCompare(second.createdAt);
    if (timeDiff !== 0) return timeDiff;

    return first.messageId.localeCompare(second.messageId);
  });
}

export function mergeMessages(
  existing: ChatMessage[] = [],
  incoming: ChatMessage[] = [],
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();

  for (const message of existing) {
    merged.set(message.messageId, message);
  }

  for (const message of incoming) {
    merged.set(message.messageId, message);
  }

  return sortMessages(Array.from(merged.values()));
}

export function toMessagePreview(message: ChatMessage): string {
  if (message.isRecalled) {
    return 'Tin nhắn đã được thu hồi';
  }

  if (message.messageType === 'CALL_LOG') {
    return message.callLog?.mode === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
  }

  if (message.messageType === 'VIDEO') {
    return 'Đã gửi một video';
  }

  if (message.messageType === 'IMAGE') {
    return 'Đã gửi một ảnh';
  }
  
  if (message.messageType === 'FILE') {
    return 'Đã gửi một tệp';
  }

  return message.content;
}
