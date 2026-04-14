import { ChatMessage, ReplyPreview as ReplyPreviewType } from '@/lib/realtime/types';
import ReplyPreview from './ReplyPreview';

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  onReply: (preview: ReplyPreviewType) => void;
  onRecall: (messageId: string) => void;
  onRedial: (mode: 'voice' | 'video') => void;
}

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} phút ${seconds} giây`;
}

export default function MessageItem({
  message,
  currentUserId,
  currentUserName,
  peerName,
  onReply,
  onRecall,
  onRedial,
}: MessageItemProps) {
  const isOwn = message.senderId === currentUserId;
  const canRecall = isOwn;
  const isCallLog = message.messageType === 'CALL_LOG' && !!message.callLog;

  const replySenderName =
    message.senderId === currentUserId ? currentUserName : peerName;

  const replyPreviewSenderName =
    message.replyPreview?.senderName
    ?? (message.replyPreview?.senderId === currentUserId ? currentUserName : peerName);

  const deliveryLabel = isOwn
    ? message.receivedAt
      ? 'Đã nhận'
      : 'Đã gửi'
    : '';

  const callTitle = (() => {
    if (!isCallLog || !message.callLog) return '';

    if (message.callLog.outcome === 'connected_ended') {
      return message.callLog.mode === 'video' ? 'Cuộc gọi video đi' : 'Cuộc gọi thoại đi';
    }

    if (message.callLog.outcome === 'peer_cancelled') {
      return message.callLog.actorUserId === currentUserId
        ? 'Bạn đã từ chối'
        : 'Người nhận từ chối';
    }

    return message.callLog.actorUserId === currentUserId
      ? 'Bạn đã hủy'
      : 'Người gọi đã hủy';
  })();

  return (
    <li className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <article className={`flex max-w-[85%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {isCallLog && message.callLog ? (
          <div className="w-58 overflow-hidden rounded-2xl border border-[#b8c5db] bg-[#dfe9f6] px-4 py-3 text-[#223457] shadow-sm">
            <p className="text-base font-semibold leading-tight">{callTitle}</p>
            <p className="mt-2 text-lg leading-none">📞</p>
            <p className="mt-1 text-xl font-medium text-[#6a7b98]">
              {message.callLog.outcome === 'connected_ended'
                ? formatCallDuration(message.callLog.durationSeconds)
                : message.callLog.mode === 'video'
                  ? 'Cuộc gọi video'
                  : 'Cuộc gọi thoại'}
            </p>
            <div className="mt-3 border-t border-[#b8c5db] pt-2 text-center">
              <button
                type="button"
                className="text-lg font-semibold text-[#0f61d4]"
                onClick={() => onRedial(message.callLog?.mode ?? 'voice')}
              >
                Gọi lại
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-3 text-[14px] shadow-sm ${
              isOwn
                ? 'rounded-br-md bg-linear-to-br from-[#0052cc] to-[#0068ff] text-white'
                : 'rounded-tl-md bg-white text-[#191c1e]'
            }`}
          >
            {message.replyPreview ? (
              <ReplyPreview
                reply={{
                  ...message.replyPreview,
                  senderName: replyPreviewSenderName,
                }}
              />
            ) : null}

            {message.isRecalled ? (
              <p className={`italic ${isOwn ? 'text-orange-100' : 'text-zinc-500'}`}>Message recalled</p>
            ) : (
              <p className="wrap-break-word whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        )}

        <footer className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {deliveryLabel ? <span>{deliveryLabel}</span> : null}
          <div className="hidden items-center gap-2 opacity-0 transition group-hover:opacity-100 md:flex">
            <button
              type="button"
              className="font-medium hover:text-zinc-700"
              onClick={() =>
                onReply({
                  messageId: message.messageId,
                  senderId: message.senderId,
                  senderName: replySenderName,
                  content: message.content,
                })
              }
              disabled={isCallLog || message.isRecalled}
            >
              Reply
            </button>
            {isOwn ? (
              <>
                <button
                  type="button"
                  className="font-medium hover:text-zinc-700"
                  onClick={() => onRecall(message.messageId)}
                  disabled={!canRecall || isCallLog || message.isRecalled}
                >
                  Recall
                </button>
              </>
            ) : null}
          </div>
        </footer>
      </article>
    </li>
  );
}
