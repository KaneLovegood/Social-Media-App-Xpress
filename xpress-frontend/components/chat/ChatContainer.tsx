"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth-client';
import { sendChatAction } from '@/lib/chat-actions';
import { ChatRoomSummary, fetchChatRooms } from '@/lib/chat-rooms';
import { CHAT_EVENTS } from '@/lib/realtime/events';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { ChatMessage, MessageStateUpdate, ReplyPreview, TypingPayload } from '@/lib/realtime/types';
import VideoCallComponent from '../video/VideoCallComponent';
import ChatHeader from './ChatHeader';
import ChatNoRoomWelcome from './ChatNoRoomWelcome';
import ChatSidebar, { SidebarChatItem } from './ChatSidebar';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

type CallMode = 'voice' | 'video' | null;

interface ChatContainerProps {
  currentUserId: string;
}

function getOrderId(peerUserId: string) {
  const digits = peerUserId.replace(/\D/g, '');
  return digits.length > 0 ? digits.slice(-4) : '1234';
}

export default function ChatContainer({ currentUserId }: ChatContainerProps) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [replyTo, setReplyTo] = useState<ReplyPreview | undefined>(undefined);
  const [typingText, setTypingText] = useState('');
  const [callMode, setCallMode] = useState<CallMode>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const token = useMemo(() => getAccessToken(), []);
  const socket = useMemo<Socket | null>(() => {
    if (!token) return null;
    return createChatSocket(token);
  }, [token]);

  useEffect(() => {
    let mounted = true;

    void fetchChatRooms()
      .then((fetchedRooms) => {
        if (!mounted) return;
        setRooms(fetchedRooms);
        setIsLoadingRooms(false);
      })
      .catch(() => {
        if (!mounted) return;
        setRooms([]);
        setIsLoadingRooms(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const effectiveActiveRoomId = useMemo(
    () => (rooms.some((room) => room.id === activeRoomId) ? activeRoomId : ''),
    [activeRoomId, rooms],
  );

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === effectiveActiveRoomId) ?? null,
    [effectiveActiveRoomId, rooms],
  );
  const peerUserId = activeRoom?.peerUserId ?? '';
  const peerName = activeRoom?.peerName ?? 'Delivery Partner';
  const orderTitle = activeRoom?.title ?? 'No active room';
  const hasRooms = rooms.length > 0;
  const orderId = useMemo(() => getOrderId(peerUserId), [peerUserId]);
  const activeMessages = useMemo(
    () => (effectiveActiveRoomId ? messagesByRoom[effectiveActiveRoomId] ?? [] : []),
    [effectiveActiveRoomId, messagesByRoom],
  );

  const roomByPeer = useMemo(
    () => new Map(rooms.map((room) => [room.peerUserId, room.id])),
    [rooms],
  );

  const sidebarRooms = useMemo<SidebarChatItem[]>(
    () =>
      rooms.map((room) => ({
        id: room.id,
        title: room.title,
        preview: room.preview,
        age: room.age,
      })),
    [rooms],
  );

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setReplyTo(undefined);
    setTypingText('');
  };

  useEffect(() => {
    if (!socket) return;

    const onMessage = (message: ChatMessage) => {
      const counterpartUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      const roomId = roomByPeer.get(counterpartUserId);
      if (!roomId) return;

      setMessagesByRoom((prev) => {
        const roomMessages = prev[roomId] ?? [];
        const exists = roomMessages.some((item) => item.messageId === message.messageId);
        if (exists) return prev;

        return {
          ...prev,
          [roomId]: [...roomMessages, message],
        };
      });

    };

    const onDeleted = (payload: MessageStateUpdate) => {
      const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
      const roomId = roomByPeer.get(counterpartUserId);
      if (!roomId) return;

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isDeleted: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onRecalled = (payload: MessageStateUpdate) => {
      const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
      const roomId = roomByPeer.get(counterpartUserId);
      if (!roomId) return;

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isRecalled: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onTyping = (payload: TypingPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      setTypingText(payload.isTyping ? 'Typing...' : '');

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText('');
      }, 1500);
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.DELETED, onDeleted);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.TYPING, onTyping);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.DELETED, onDeleted);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.disconnect();
    };
  }, [currentUserId, peerUserId, roomByPeer, socket]);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: 'smooth',
    });
  }, [activeMessages]);

  const handleSend = (content: string) => {
    if (!socket || !peerUserId || !effectiveActiveRoomId) return;

    if (replyTo) {
      socket.emit(CHAT_EVENTS.REPLY, {
        receiverId: peerUserId,
        content,
        replyToMessageId: replyTo.messageId,
      });
      setReplyTo(undefined);
      return;
    }

    socket.emit(CHAT_EVENTS.SEND, {
      receiverId: peerUserId,
      content,
    });
  };

  const handleDelete = (messageId: string) => {
    socket?.emit(CHAT_EVENTS.DELETE, { messageId });
  };

  const handleRecall = (messageId: string) => {
    socket?.emit(CHAT_EVENTS.RECALL, { messageId });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!peerUserId) return;
    socket?.emit(CHAT_EVENTS.TYPING, {
      receiverId: peerUserId,
      isTyping,
    });
  };

  const openVoiceCall = () => {
    if (!peerUserId) return;
    setCallMode('voice');
    void sendChatAction('open_voice_call', {
      peerUserId,
      orderId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  const openVideoCall = () => {
    if (!peerUserId) return;
    setCallMode('video');
    void sendChatAction('open_video_call', {
      peerUserId,
      orderId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  return (
    <section className="h-full w-full bg-[#f4f4f6] overflow-hidden">
      <div className="grid h-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <ChatSidebar
          rooms={sidebarRooms}
          activeRoomId={effectiveActiveRoomId}
          onSelectRoom={handleSelectRoom}
        />

        <div className="flex min-h-screen flex-col bg-[#f7f8fa] lg:min-h-0 lg:border-r lg:border-zinc-200/80">
          {!isLoadingRooms && (!hasRooms || !effectiveActiveRoomId) ? (
            <ChatNoRoomWelcome />
          ) : (
            <>
              <ChatHeader
                peerName={peerName}
                orderTitle={orderTitle}
                typingText={typingText}
                onOpenVoiceCall={openVoiceCall}
                onOpenVideoCall={openVideoCall}
              />

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-5 lg:pt-4">
                <MessageList
                  messages={activeMessages}
                  currentUserId={currentUserId}
                  listRef={listRef}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  onRecall={handleRecall}
                  className="flex-1"
                />
                <div className="mt-3 lg:mt-4">
                  <MessageInput
                    replyTo={replyTo}
                    onClearReply={() => setReplyTo(undefined)}
                    onSend={handleSend}
                    onTyping={handleTyping}
                  />
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <VideoCallComponent
        socket={socket}
        currentUserId={currentUserId}
        peerUserId={peerUserId}
        peerName={peerName}
        orderTitle={orderTitle}
        callMode={callMode}
        onModeChange={setCallMode}
        onClose={() => setCallMode(null)}
      />
    </section>
  );
}
