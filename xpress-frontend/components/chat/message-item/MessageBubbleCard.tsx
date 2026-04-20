import { ChatMessage } from '@/lib/realtime/types';
import { PhoneCall, PhoneMissed, PhoneOutgoing, Video, VideoOff, FileText, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReplyPreview from './ReplyPreview';

interface MessageBubbleCardProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  currentUserName: string;
  peerName: string;
  onRedial: (mode: 'voice' | 'video') => void;
  onImageClick?: (url: string, senderName?: string, timestamp?: string) => void;
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
  onImageClick,
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
        <div className="flex flex-col gap-2">
          {message.messageType === 'IMAGE' && message.fileUrl && (
            <img 
              src={message.fileUrl} 
              alt={message.fileName || 'Image'} 
              className={`max-w-60 max-h-75 rounded-lg object-cover border border-white/20 ${onImageClick ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
              loading="lazy" 
              onClick={() => {
                if (onImageClick) {
                  const senderName = isOwn ? currentUserName : peerName;
                  const timestamp = new Date(message.createdAt).toLocaleString('vi-VN');
                  onImageClick(message.fileUrl!, senderName, timestamp);
                }
              }}
            />
          )}

          {message.messageType === 'FILE' && message.fileUrl && (
            <a 
              href={message.fileUrl} 
              target="_blank" 
              rel="noreferrer" 
              className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
                isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className={`p-2 rounded-full shrink-0 ${isOwn ? 'bg-white/30 text-white' : 'bg-white text-gray-700'}`}>
                <FileText size={20} />
              </div>
              <div className="flex flex-col min-w-0 max-w-40 overflow-hidden">
                <span className="font-semibold text-sm truncate">{message.fileName || 'Tài liệu đính kèm'}</span>
                {message.fileSize && (
                  <span className="text-xs opacity-80">{Math.round(message.fileSize / 1024)} KB</span>
                )}
              </div>
              <Download size={16} className={`ml-2 ${isOwn ? 'text-white/80' : 'text-gray-500'}`} />
            </a>
          )}

          {message.content && (
            <div className={`wrap-break-word ${message.senderId === 'AI_ASSISTANT' || message.senderId === 'SYSTEM' ? 'prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0' : 'whitespace-pre-wrap'}`}>
              {message.senderId === 'AI_ASSISTANT' || message.senderId === 'SYSTEM' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}