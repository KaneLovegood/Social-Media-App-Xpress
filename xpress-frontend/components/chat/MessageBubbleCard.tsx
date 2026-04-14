import { ChatMessage } from '@/lib/realtime/types';
import { PhoneCall, PhoneMissed, PhoneOutgoing, Video, VideoOff } from 'lucide-react';
import ReplyPreview from './ReplyPreview';

interface MessageBubbleCardProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  onRedial: (mode: 'voice' | 'video') => void;
}

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} phút ${seconds} giây`;
}

type CallLogViewModel = {
  title: string;
  subtitle: string;
  Icon: typeof PhoneCall;
  iconClassName: string;
  ringClassName?: string;
  showPulse?: boolean;
};

function getCallLogViewModel(callLog: NonNullable<ChatMessage['callLog']>, currentUserId: string): CallLogViewModel {
  const isVideo = callLog.mode === 'video';
  const isConnected = callLog.outcome === 'connected_ended';
  const canceledByCurrentUser = callLog.actorUserId === currentUserId;

  if (isConnected) {
    return {
      title: isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại',
      subtitle: formatCallDuration(callLog.durationSeconds),
      Icon: isVideo ? Video : PhoneCall,
      iconClassName: 'text-emerald-600',
      ringClassName: 'border-emerald-200 bg-emerald-50',
      showPulse: !isVideo,
    };
  }

  if (canceledByCurrentUser) {
    return {
      title: 'Bạn đã từ chối',
      subtitle: isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại',
      Icon: isVideo ? VideoOff : PhoneOutgoing,
      iconClassName: 'text-red-500',
      ringClassName: 'border-red-200 bg-red-50',
    };
  }

  return {
    title: 'Người gọi đã hủy',
    subtitle: isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại',
    Icon: isVideo ? VideoOff : PhoneMissed,
    iconClassName: 'text-red-500',
    ringClassName: 'border-red-200 bg-red-50',
  };
}

export default function MessageBubbleCard({
  message,
  isOwn,
  currentUserId,
  currentUserName,
  peerName,
  onRedial,
}: MessageBubbleCardProps) {
  const isCallLog = message.messageType === 'CALL_LOG' && !!message.callLog;

  const replyPreviewSenderName =
    message.replyPreview?.senderName
    ?? (message.replyPreview?.senderId === currentUserId ? currentUserName : peerName);

  const callView = isCallLog && message.callLog
    ? getCallLogViewModel(message.callLog, currentUserId)
    : null;

  if (isCallLog && message.callLog) {
    return (
      <div className="w-58 overflow-hidden rounded-2xl border border-[#b8c5db] bg-[#dfe9f6] px-4 py-3 text-[#223457] shadow-sm">
        <p className="text-sm font-semibold leading-tight">{callView?.title}</p>
        <div className="mt-1 flex items-center gap-2 text-base font-medium text-[#6a7b98]">
          {callView ? (
            <span className={`relative flex h-6 w-6 items-center justify-center rounded-full border ${callView.ringClassName ?? 'border-zinc-200 bg-white'}`}>
              <callView.Icon className={`relative h-4 w-4 ${callView.iconClassName}`} />
            </span>
          ) : null}
          <span>{callView?.subtitle ?? ''}</span>
        </div>
        <div className="mt-3 border-t border-[#b8c5db] pt-2 text-center">
          <button
            type="button"
            className="text-md font-semibold text-[#0f61d4]"
            onClick={() => onRedial(message.callLog?.mode ?? 'voice')}
          >
            Gọi lại
          </button>
        </div>
      </div>
    );
  }

  return (
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
        <p className={`italic ${isOwn ? 'text-orange-100' : 'text-zinc-500'}`}>Tin nhắn đã được thu hồi</p>
      ) : (
        <p className="wrap-break-word whitespace-pre-wrap">{message.content}</p>
      )}
    </div>
  );
}