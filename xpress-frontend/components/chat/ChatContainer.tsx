"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getValidAccessToken } from '@/lib/auth-client';
import { sendChatAction } from '@/lib/chat-actions';
import { fetchChatRoomMessages } from '@/lib/chat-messages';
import { ChatRoomSummary, fetchChatRooms } from '@/lib/chat-rooms';
import { CALL_EVENTS, CHAT_EVENTS } from '@/lib/realtime/events';
import { createChatSocket } from '@/lib/realtime/socket-client';
import { CallEndPayload, ChatMessage, MessageStateUpdate, PresencePayload, ReplyPreview, TypingPayload } from '@/lib/realtime/types';
import IncomingCallModal from './IncomingCallModal';
import VideoCallComponent from '../video/VideoCallComponent';
import ChatHeader from './ChatHeader';
import ChatNoRoomWelcome from './ChatNoRoomWelcome';
import ChatSidebar, { SidebarChatItem } from './ChatSidebar';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

type CallMode = 'voice' | 'video' | null;
type CallDirection = 'incoming' | 'outgoing' | null;

function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

function toAgeLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp).getTime();
  if (Number.isNaN(at)) return 'Now';

  const deltaMs = Math.max(0, Date.now() - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return 'Now';
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)}m ago`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)}h ago`;
  return `${Math.floor(deltaMs / day)}d ago`;
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((first, second) => {
    const timeDiff = first.createdAt.localeCompare(second.createdAt);
    if (timeDiff !== 0) return timeDiff;

    return first.messageId.localeCompare(second.messageId);
  });
}

function mergeMessages(existing: ChatMessage[] = [], incoming: ChatMessage[] = []): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();

  for (const message of existing) {
    merged.set(message.messageId, message);
  }

  for (const message of incoming) {
    merged.set(message.messageId, message);
  }

  return sortMessages(Array.from(merged.values()));
}

interface ChatContainerProps {
  currentUserId: string;
  currentUserName: string;
  initialRoomId?: string;
  initialPeerUserId?: string;
}

export default function ChatContainer({
  currentUserId,
  currentUserName,
  initialRoomId,
  initialPeerUserId,
}: ChatContainerProps) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [loadedRoomIds, setLoadedRoomIds] = useState<Record<string, boolean>>({});
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
  const [presenceByUser, setPresenceByUser] = useState<Record<string, boolean>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    void getValidAccessToken().then((token) => {
      if (!token || cancelled || socketRef.current) return;
      socket = createChatSocket(token);
      socketRef.current = socket;
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetchChatRooms()
      .then((fetchedRooms) => {
        if (!mounted) return;
        setRooms(fetchedRooms);
        setPresenceByUser(
          fetchedRooms.reduce<Record<string, boolean>>((acc, room) => {
            acc[room.peerUserId] = room.isPeerOnline;
            return acc;
          }, {}),
        );
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
  const isPeerOnline = peerUserId ? (presenceByUser[peerUserId] ?? activeRoom?.isPeerOnline ?? false) : false;
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
        unreadCount: room.unreadCount,
        isOnline: presenceByUser[room.peerUserId] ?? room.isPeerOnline,
      })),
    [presenceByUser, rooms],
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
    if (!effectiveActiveRoomId || loadedRoomIds[effectiveActiveRoomId]) {
      return;
    }

    let cancelled = false;

    void fetchChatRoomMessages(effectiveActiveRoomId)
      .then((fetchedMessages) => {
        if (cancelled) return;

        setMessagesByRoom((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: mergeMessages(prev[effectiveActiveRoomId], fetchedMessages),
        }));
      })
      .catch(() => {
        if (cancelled) return;

        setMessagesByRoom((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: prev[effectiveActiveRoomId] ?? [],
        }));
      })
      .finally(() => {
        if (cancelled) return;

        setLoadedRoomIds((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveActiveRoomId, loadedRoomIds]);

  useEffect(() => {
    if (!effectiveActiveRoomId || !socketRef.current) return;

    socketRef.current.emit(CHAT_EVENTS.READ, {
      roomId: effectiveActiveRoomId,
    });

    setRooms((prev) =>
      prev.map((room) =>
        room.id === effectiveActiveRoomId
          ? { ...room, unreadCount: 0 }
          : room,
      ),
    );
  }, [effectiveActiveRoomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMessage = (message: ChatMessage) => {
      const counterpartUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        roomId = toPrivateRoomId(currentUserId, counterpartUserId);
      }

      const isIncoming = message.receiverId === currentUserId;
      const shouldIncreaseUnread = isIncoming && roomId !== effectiveActiveRoomId;

      if (isIncoming) {
        socket.emit(CHAT_EVENTS.RECEIVE, { messageId: message.messageId });

        if (roomId === effectiveActiveRoomId) {
          socket.emit(CHAT_EVENTS.READ, { roomId });
        }
      }

      setMessagesByRoom((prev) => {
        return {
          ...prev,
          [roomId]: mergeMessages(prev[roomId], [message]),
        };
      });

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === roomId);
        if (!existed) {
          return [
            {
              id: roomId,
              title: counterpartUserId === peerUserId ? peerName : counterpartUserId,
              peerUserId: counterpartUserId,
              peerName: counterpartUserId === peerUserId ? peerName : counterpartUserId,
              preview: message.content,
              age: toAgeLabel(message.createdAt),
              unreadCount: shouldIncreaseUnread ? 1 : 0,
              isPeerOnline: presenceByUser[counterpartUserId] ?? false,
            },
            ...prev,
          ];
        }

        return prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            preview: message.content,
            age: toAgeLabel(message.createdAt),
            unreadCount: shouldIncreaseUnread ? room.unreadCount + 1 : room.unreadCount,
          };
        });
      });
    };

    const onRecalled = (payload: MessageStateUpdate) => {
      const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        roomId = toPrivateRoomId(currentUserId, counterpartUserId);
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: sortMessages((prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isRecalled: true, updatedAt: payload.updatedAt ?? message.updatedAt }
            : message,
        )),
      }));
    };

    const onReceived = (payload: MessageStateUpdate) => {
      const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        roomId = toPrivateRoomId(currentUserId, counterpartUserId);
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: sortMessages((prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? {
              ...message,
              receivedAt: payload.receivedAt,
              updatedAt: payload.updatedAt ?? message.updatedAt,
            }
            : message,
        )),
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

    const onCallEnd = (payload: CallEndPayload) => {
      if (payload.receiverId !== currentUserId) return;

      setIncomingCall((prev) => {
        if (!prev || prev.senderId !== payload.senderId) {
          return prev;
        }

        return null;
      });
    };

    const onPresence = (payload: PresencePayload) => {
      setPresenceByUser((prev) => ({
        ...prev,
        [payload.userId]: payload.isOnline,
      }));

      setRooms((prev) =>
        prev.map((room) =>
          room.peerUserId === payload.userId
            ? { ...room, isPeerOnline: payload.isOnline }
            : room,
        ),
      );
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.RECEIVED, onReceived);
    socket.on(CHAT_EVENTS.PRESENCE, onPresence);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);
    socket.on(CALL_EVENTS.END, onCallEnd);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.RECEIVED, onReceived);
      socket.off(CHAT_EVENTS.PRESENCE, onPresence);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
      socket.off(CALL_EVENTS.END, onCallEnd);
    };
  }, [currentUserId, effectiveActiveRoomId, peerName, peerUserId, presenceByUser, roomByPeer]);

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
    socketRef.current?.emit(CALL_EVENTS.END, {
      receiverId: incomingCall.senderId,
      reason: 'declined',
    });
    setIncomingCall(null);
    setCallDirection(null);
    setCallMode(null);
    void sendChatAction('decline_call', {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleCloseCall = useCallback(() => {
    setCallMode(null);
    setCallDirection(null);
  }, []);

  const handleRedial = (mode: 'voice' | 'video') => {
    if (mode === 'video') {
      openVideoCall();
      return;
    }

    openVoiceCall();
  };

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
                isPeerOnline={isPeerOnline}
                onOpenVoiceCall={openVoiceCall}
                onOpenVideoCall={openVideoCall}
              />

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
                <MessageList
                  messages={activeMessages}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  peerName={peerName}
                  listRef={listRef}
                  onReply={setReplyTo}
                  onRecall={handleRecall}
                  onRedial={handleRedial}
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
