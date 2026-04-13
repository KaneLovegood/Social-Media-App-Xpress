"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth-client';
import { sendChatAction } from '@/lib/chat-actions';
import { ChatRoomSummary, fetchChatRooms } from '@/lib/chat-rooms';
import { CALL_EVENTS, CHAT_EVENTS } from '@/lib/realtime/events';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { ChatMessage, MessageStateUpdate, ReplyPreview, TypingPayload } from '@/lib/realtime/types';
import IncomingCallModal from './IncomingCallModal';
import VideoCallComponent from '../video/VideoCallComponent';
import ChatHeader from './ChatHeader';
import ChatNoRoomWelcome from './ChatNoRoomWelcome';
import ChatSidebar, { SidebarChatItem } from './ChatSidebar';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

type CallMode = 'voice' | 'video' | null;
type CallDirection = 'incoming' | 'outgoing' | null;

interface ChatContainerProps {
  currentUserId: string;
  initialRoomId?: string;
  initialPeerUserId?: string;
}

export default function ChatContainer({
  currentUserId,
  initialRoomId,
  initialPeerUserId,
}: ChatContainerProps) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [replyTo, setReplyTo] = useState<ReplyPreview | undefined>(undefined);
  const [typingText, setTypingText] = useState('');
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callDirection, setCallDirection] = useState<CallDirection>(null);
  const [incomingCall, setIncomingCall] = useState<{
    senderId: string;
    senderName: string;
    callMode: 'voice' | 'video';
    sessionId: string;
    isOnline: boolean;
  } | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) {
      socketRef.current = null;
      return;
    }

    if (!socketRef.current) {
      socketRef.current = createChatSocket(token);
    }
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
  const peerName = activeRoom?.peerName ?? 'User';
  const orderTitle = activeRoom?.title ?? 'No active room';
  const hasRooms = rooms.length > 0;
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
    if (rooms.length === 0) return;

    if (activeRoomId && rooms.some((room) => room.id === activeRoomId)) {
      return;
    }

    if (initialRoomId && rooms.some((room) => room.id === initialRoomId)) {
      setActiveRoomId(initialRoomId);
      return;
    }

    if (initialPeerUserId) {
      const room = rooms.find((item) => item.peerUserId === initialPeerUserId);
      if (room) {
        setActiveRoomId(room.id);
      }
    }
  }, [activeRoomId, initialPeerUserId, initialRoomId, rooms]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMessage = (message: ChatMessage) => {
      const counterpartUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      let roomId = roomByPeer.get(counterpartUserId);
      
      // Fallback: if room not yet loaded, compute room ID from conversation
      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

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
      let roomId = roomByPeer.get(counterpartUserId);
      
      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

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
      let roomId = roomByPeer.get(counterpartUserId);
      
      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

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

    const onIncomingCall = (payload: {
      senderId: string;
      senderName: string;
      callMode: 'voice' | 'video';
      sessionId: string;
      isOnline: boolean;
    }) => {
      setIncomingCall(payload);
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.DELETED, onDeleted);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.DELETED, onDeleted);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
    };
  }, [currentUserId, peerUserId, roomByPeer]);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: 'smooth',
    });
  }, [activeMessages]);

  const handleSend = (content: string) => {
    if (!socketRef.current || !peerUserId || !effectiveActiveRoomId) return;

    if (replyTo) {
      socketRef.current.emit(CHAT_EVENTS.REPLY, {
        receiverId: peerUserId,
        content,
        replyToMessageId: replyTo.messageId,
      });
      setReplyTo(undefined);
      return;
    }

    socketRef.current.emit(CHAT_EVENTS.SEND, {
      receiverId: peerUserId,
      content,
    });
  };

  const handleDelete = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.DELETE, { messageId });
  };

  const handleRecall = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.RECALL, { messageId });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!peerUserId) return;
    socketRef.current?.emit(CHAT_EVENTS.TYPING, {
      receiverId: peerUserId,
      isTyping,
    });
  };

  const openVoiceCall = () => {
    if (!peerUserId) return;
    setCallDirection('outgoing');
    setCallMode('voice');
    void sendChatAction('open_voice_call', {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  const openVideoCall = () => {
    if (!peerUserId) return;
    setCallDirection('outgoing');
    setCallMode('video');
    void sendChatAction('open_video_call', {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    setCallDirection('incoming');
    setCallMode(incomingCall.callMode);
    setIncomingCall(null);
    void sendChatAction('accept_call', {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    setIncomingCall(null);
    setCallDirection(null);
    void sendChatAction('decline_call', {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleCloseCall = useCallback(() => {
    setCallMode(null);
    setCallDirection(null);
  }, []);

  return (
    <section className="h-full w-full overflow-hidden bg-[#f8f9fb]">
      <div className="flex h-full">
        <ChatSidebar
          rooms={sidebarRooms}
          activeRoomId={effectiveActiveRoomId}
          onSelectRoom={handleSelectRoom}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#f8f9fb] lg:min-h-0">
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

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
                <MessageList
                  messages={activeMessages}
                  currentUserId={currentUserId}
                  listRef={listRef}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  onRecall={handleRecall}
                  className="flex-1"
                />
                <div className="mt-2 lg:mt-3">
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

      <IncomingCallModal
        isOpen={incomingCall !== null}
        senderName={incomingCall?.senderName ?? ''}
        callMode={incomingCall?.callMode ?? 'voice'}
        isOnline={incomingCall?.isOnline ?? false}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      <VideoCallComponent
        socket={socketRef.current}
        currentUserId={currentUserId}
        peerUserId={peerUserId}
        peerName={peerName}
        orderTitle={orderTitle}
        callMode={callMode}
        callDirection={callDirection}
        onModeChange={setCallMode}
        onClose={handleCloseCall}
      />
    </section>
  );
}
