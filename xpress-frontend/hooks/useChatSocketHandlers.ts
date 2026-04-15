import {
  useEffect,
  useRef,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Socket } from "socket.io-client";
import { CHAT_EVENTS, CALL_EVENTS } from "@/lib/realtime/events";
import {
  CallEndPayload,
  ChatMessage,
  GroupCallEndPayload,
  GroupCallStartedPayload,
  MessageStateUpdate,
  PresencePayload,
  TypingPayload,
} from "@/lib/realtime/types";
import { GroupRoomDetails } from "@/lib/chat-groups";
import {
  toPrivateRoomId,
  toAgeLabel,
  toMessagePreview,
  mergeMessages,
  sortMessages,
} from "@/lib/chat-utils";
import { ChatRoomSummary } from "@/lib/chat-rooms";

type CallMode = "voice" | "video" | null;
type CallDirection = "incoming" | "outgoing" | null;

interface IncomingCallState {
  senderId: string;
  senderName: string;
  callMode: "voice" | "video";
  sessionId: string;
  isOnline: boolean;
}

interface PendingGroupCallState {
  roomId: string;
  callMode: "voice" | "video";
  senderId: string;
}

interface SocketHandlerProps {
  socket: Socket | null;
  currentUserId: string;
  effectiveActiveRoomId: string;
  activeRoomRoomType: "PRIVATE" | "GROUP" | null;
  peerUserId: string;
  roomByPeer: Map<string, string>;
  reloadRooms: () => Promise<void>;
  ensureGroupDetails: (roomId: string) => Promise<GroupRoomDetails>;
  setMessages: (
    updater: (
      prev: Record<string, ChatMessage[]>,
    ) => Record<string, ChatMessage[]>,
  ) => void;
  setRooms: (updater: (prev: ChatRoomSummary[]) => ChatRoomSummary[]) => void;
  setGroupDetails: (
    updater: (
      prev: Record<string, GroupRoomDetails>,
    ) => Record<string, GroupRoomDetails>,
  ) => void;
  setPresenceByUser: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
  setTypingText: (text: string) => void;
  setIncomingCall: Dispatch<SetStateAction<IncomingCallState | null>>;
  activeRoomId?: string;
  setActiveRoomId?: (roomId: string) => void;
  groupCallRoomId?: string;
  groupCallMode?: CallMode;
  pendingGroupCall?: PendingGroupCallState | null;
  setGroupCallRoomId: (roomId: string) => void;
  setGroupCallMode: (mode: CallMode) => void;
  setGroupCallDirection: (dir: CallDirection) => void;
  setPendingGroupCall: (call: PendingGroupCallState | null) => void;
  setCallMode: (mode: CallMode) => void;
  setCallDirection: (dir: CallDirection) => void;
}

export function useChatSocketHandlers(props: SocketHandlerProps) {
  const {
    socket,
    currentUserId,
    effectiveActiveRoomId,
    activeRoomRoomType,
    peerUserId,
    roomByPeer,
    reloadRooms,
    ensureGroupDetails,
    setMessages,
    setRooms,
    setGroupDetails,
    setPresenceByUser,
    setTypingText,
    setIncomingCall,
    setGroupCallRoomId,
    setGroupCallMode,
    setGroupCallDirection,
    setPendingGroupCall,
    setCallMode,
    setCallDirection,
  } = props;

  const typingTimeoutRef = useRef<number | null>(null);

  // Private message handler
  const onMessage = useCallback(
    (message: ChatMessage) => {
      const isPrivateConversation =
        message.roomType === "PRIVATE" || message.conversationId.includes(":");
      if (message.roomType === "GROUP" || !isPrivateConversation) {
        return;
      }

      const counterpartUserId =
        message.senderId === currentUserId
          ? message.receiverId
          : message.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        roomId = toPrivateRoomId(currentUserId, counterpartUserId);
      }

      const isIncoming = message.receiverId === currentUserId;
      const shouldIncreaseUnread =
        isIncoming && roomId !== effectiveActiveRoomId;

      if (isIncoming) {
        socket?.emit(CHAT_EVENTS.RECEIVE, { messageId: message.messageId });

        if (roomId === effectiveActiveRoomId) {
          socket?.emit(CHAT_EVENTS.READ, { roomId });
        }
      }

      setMessages((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId], [message]),
      }));

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === roomId);
        if (!existed) {
          void reloadRooms().catch(() => {
            // Keep current sidebar state when refresh fails.
          });
          return prev;
        }

        return prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            preview: message.content,
            lastMessageAt: message.createdAt,
            age: toAgeLabel(message.createdAt),
            unreadCount: shouldIncreaseUnread
              ? room.unreadCount + 1
              : room.unreadCount,
          };
        });
      });
    },
    [
      currentUserId,
      effectiveActiveRoomId,
      roomByPeer,
      socket,
      setMessages,
      setRooms,
      reloadRooms,
    ],
  );

  // Group message handler
  const onGroupMessage = useCallback(
    (message: ChatMessage) => {
      const roomId = message.roomId ?? message.conversationId;
      if (!roomId) return;

      const shouldIncreaseUnread =
        message.senderId !== currentUserId && roomId !== effectiveActiveRoomId;

      setMessages((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId], [message]),
      }));

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === roomId);

        if (!existed) {
          void reloadRooms().catch(() => {
            // Keep current sidebar state when refresh fails.
          });
          return prev;
        }

        return prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            preview: toMessagePreview(message),
            lastMessageAt: message.createdAt,
            age: toAgeLabel(message.createdAt),
            unreadCount: shouldIncreaseUnread
              ? room.unreadCount + 1
              : room.unreadCount,
          };
        });
      });

      setGroupDetails((prev) => {
        const existed = prev[roomId];
        if (!existed) return prev;

        return {
          ...prev,
          [roomId]: {
            ...existed,
            lastMessageAt: message.createdAt,
            lastMessagePreview: message.content,
          },
        };
      });

      if (roomId === effectiveActiveRoomId) {
        socket?.emit(CHAT_EVENTS.GROUP_READ, { roomId });
      }
    },
    [
      currentUserId,
      effectiveActiveRoomId,
      socket,
      setMessages,
      setRooms,
      setGroupDetails,
      reloadRooms,
    ],
  );

  // Message recalled handler
  const onRecalled = useCallback(
    (payload: MessageStateUpdate) => {
      const roomId =
        payload.roomId ??
        (() => {
          const counterpartUserId =
            payload.senderId === currentUserId
              ? payload.receiverId
              : payload.senderId;
          return (
            roomByPeer.get(counterpartUserId) ??
            toPrivateRoomId(currentUserId, counterpartUserId)
          );
        })();

      setMessages((prev) => {
        const updatedRoomMessages = sortMessages(
          (prev[roomId] ?? []).map((message) =>
            message.messageId === payload.messageId
              ? {
                  ...message,
                  isRecalled: true,
                  updatedAt: payload.updatedAt ?? message.updatedAt,
                }
              : message,
          ),
        );

        const latestMessage =
          updatedRoomMessages[updatedRoomMessages.length - 1];

        if (latestMessage) {
          setRooms((prevRooms) =>
            prevRooms.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    preview: toMessagePreview(latestMessage),
                    age: toAgeLabel(latestMessage.createdAt),
                  }
                : room,
            ),
          );
        }

        return {
          ...prev,
          [roomId]: updatedRoomMessages,
        };
      });
    },
    [currentUserId, roomByPeer, setMessages, setRooms],
  );

  // Message received handler
  const onReceived = useCallback(
    (payload: MessageStateUpdate) => {
      const roomId =
        payload.roomId ??
        (() => {
          const counterpartUserId =
            payload.senderId === currentUserId
              ? payload.receiverId
              : payload.senderId;
          return (
            roomByPeer.get(counterpartUserId) ??
            toPrivateRoomId(currentUserId, counterpartUserId)
          );
        })();

      setMessages((prev) => ({
        ...prev,
        [roomId]: sortMessages(
          (prev[roomId] ?? []).map((message) =>
            message.messageId === payload.messageId
              ? {
                  ...message,
                  receivedAt: payload.receivedAt,
                  updatedAt: payload.updatedAt ?? message.updatedAt,
                }
              : message,
          ),
        ),
      }));
    },
    [currentUserId, roomByPeer, setMessages],
  );

  // Typing indicator handler
  const onTyping = useCallback(
    (payload: TypingPayload) => {
      const isGroupTyping = Boolean(payload.roomId);
      const isCurrentRoom = isGroupTyping
        ? payload.roomId === effectiveActiveRoomId
        : payload.senderId === peerUserId &&
          payload.receiverId === currentUserId;

      if (!isCurrentRoom) return;

      setTypingText(
        payload.isTyping
          ? isGroupTyping
            ? "Có người đang nhập..."
            : "Typing..."
          : "",
      );

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText("");
      }, 1500);
    },
    [effectiveActiveRoomId, peerUserId, currentUserId, setTypingText],
  );

  // Group room updated handler
  const onGroupRoomUpdated = useCallback(
    (payload: GroupRoomDetails) => {
      setGroupDetails((prev) => ({
        ...prev,
        [payload.roomId]: payload,
      }));

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === payload.roomId);
        const nextItem: ChatRoomSummary = {
          id: payload.roomId,
          roomType: "GROUP",
          title: payload.title,
          peerUserId: payload.roomId,
          peerName: payload.title,
          avatarUrl: payload.avatarUrl,
          description: payload.description,
          emoji: payload.emoji,
          memberCount: payload.memberCount,
          preview:
            payload.lastMessagePreview ??
            existed?.preview ??
            "Bắt đầu trò chuyện trong nhóm",
          lastMessageAt:
            payload.lastMessageAt ??
            existed?.lastMessageAt ??
            new Date().toISOString(),
          age: payload.lastMessageAt
            ? toAgeLabel(payload.lastMessageAt)
            : (existed?.age ?? "Now"),
          unreadCount: existed?.unreadCount ?? 0,
          isPeerOnline: false,
        };

        if (!existed) {
          return [nextItem, ...prev];
        }

        return prev.map((room) =>
          room.id === payload.roomId ? { ...room, ...nextItem } : room,
        );
      });
    },
    [setGroupDetails, setRooms],
  );

  // Group member left handler
  const onGroupMemberLeft = useCallback(
    (payload: {
      roomId: string;
      userId: string;
      payload?: GroupRoomDetails;
    }) => {
      if (payload.userId === currentUserId) {
        setRooms((prev) => prev.filter((room) => room.id !== payload.roomId));
        setGroupDetails((prev) => {
          if (!prev[payload.roomId]) return prev;

          const next = { ...prev };
          delete next[payload.roomId];
          return next;
        });

        if (props.activeRoomId === payload.roomId) {
          props.setActiveRoomId?.("");
        }

        if (props.groupCallRoomId === payload.roomId) {
          setGroupCallRoomId("");
          setGroupCallMode(null);
          setGroupCallDirection(null);
          setPendingGroupCall(null);
        }

        return;
      }

      if (payload.payload) {
        onGroupRoomUpdated(payload.payload);
      }
      setGroupDetails((prev) => {
        const existing = prev[payload.roomId];
        if (!existing) return prev;

        return {
          ...prev,
          [payload.roomId]: {
            ...existing,
            members: existing.members.filter(
              (member) => member.userId !== payload.userId,
            ),
            memberCount: Math.max(0, existing.memberCount - 1),
          },
        };
      });
    },
    [
      currentUserId,
      onGroupRoomUpdated,
      setRooms,
      setGroupDetails,
      props.activeRoomId,
      props.setActiveRoomId,
      props.groupCallRoomId,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      setPendingGroupCall,
    ],
  );

  // Group call started handler
  const onGroupCallStarted = useCallback(
    async (payload: GroupCallStartedPayload) => {
      if (
        payload.roomId === props.groupCallRoomId &&
        props.groupCallMode === payload.callMode
      ) {
        return;
      }

      try {
        await ensureGroupDetails(payload.roomId);
      } catch {
        return;
      }

      setCallMode(null);
      setCallDirection(null);
      setIncomingCall(null);

      if (payload.senderId === currentUserId) {
        setPendingGroupCall(null);
        setGroupCallRoomId(payload.roomId);
        setGroupCallMode(payload.callMode);
        setGroupCallDirection("outgoing");
        return;
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setPendingGroupCall({
        roomId: payload.roomId,
        callMode: payload.callMode,
        senderId: payload.senderId,
      });
    },
    [
      currentUserId,
      ensureGroupDetails,
      setCallMode,
      setCallDirection,
      setIncomingCall,
      setPendingGroupCall,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      props.groupCallRoomId,
      props.groupCallMode,
    ],
  );

  // Group call ended handler
  const onGroupCallEnded = useCallback(
    (payload: GroupCallEndPayload) => {
      if (payload.roomId !== props.groupCallRoomId) {
        if (props.pendingGroupCall?.roomId !== payload.roomId) {
          return;
        }
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setPendingGroupCall(null);
    },
    [
      props.groupCallRoomId,
      props.pendingGroupCall,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      setPendingGroupCall,
    ],
  );

  // Group dissolved handler
  const onGroupDissolved = useCallback(
    (payload: { roomId: string }) => {
      setRooms((prev) => prev.filter((room) => room.id !== payload.roomId));
      setGroupDetails((prev) => {
        if (!prev[payload.roomId]) return prev;

        const next = { ...prev };
        delete next[payload.roomId];
        return next;
      });

      if (props.activeRoomId === payload.roomId) {
        props.setActiveRoomId?.("");
      }

      if (props.groupCallRoomId === payload.roomId) {
        setGroupCallRoomId("");
        setGroupCallMode(null);
        setGroupCallDirection(null);
        setPendingGroupCall(null);
      }
    },
    [
      props,
      setRooms,
      setGroupDetails,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      setPendingGroupCall,
    ],
  );

  // Incoming call handler
  const onIncomingCall = useCallback(
    (payload: {
      senderId: string;
      senderName: string;
      callMode: "voice" | "video";
      sessionId: string;
      isOnline: boolean;
    }) => {
      setIncomingCall(payload);
    },
    [setIncomingCall],
  );

  // Call ended handler
  const onCallEnd = useCallback(
    (payload: CallEndPayload) => {
      if (payload.receiverId !== currentUserId) return;

      setIncomingCall((prev) => {
        if (!prev || prev.senderId !== payload.senderId) {
          return prev;
        }

        return null;
      });
    },
    [currentUserId, setIncomingCall],
  );

  // Presence updated handler
  const onPresence = useCallback(
    (payload: PresencePayload) => {
      setPresenceByUser((prev) => ({
        ...prev,
        [payload.userId]: payload.isOnline,
      }));

      setRooms((prev) =>
        prev.map((room) =>
          room.roomType === "PRIVATE" && room.peerUserId === payload.userId
            ? { ...room, isPeerOnline: payload.isOnline }
            : room,
        ),
      );

      setGroupDetails((prev) => {
        let changed = false;
        const next: Record<string, GroupRoomDetails> = { ...prev };

        for (const [roomId, details] of Object.entries(prev)) {
          const updatedMembers = details.members.map((member) => {
            if (
              member.userId !== payload.userId ||
              member.isOnline === payload.isOnline
            ) {
              return member;
            }

            changed = true;
            return {
              ...member,
              isOnline: payload.isOnline,
            };
          });

          if (changed) {
            next[roomId] = {
              ...details,
              members: updatedMembers,
            };
          }
        }

        return changed ? next : prev;
      });
    },
    [setPresenceByUser, setRooms, setGroupDetails],
  );

  // Attach all event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.RECEIVED, onReceived);
    socket.on(CHAT_EVENTS.PRESENCE, onPresence);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
    socket.on(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
    socket.on(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
    socket.on(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
    socket.on(CHAT_EVENTS.GROUP_DISSOLVED, onGroupDissolved);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);
    socket.on(CALL_EVENTS.END, onCallEnd);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.RECEIVED, onReceived);
      socket.off(CHAT_EVENTS.PRESENCE, onPresence);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
      socket.off(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
      socket.off(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
      socket.off(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
      socket.off(CHAT_EVENTS.GROUP_DISSOLVED, onGroupDissolved);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
      socket.off(CALL_EVENTS.END, onCallEnd);
    };
  }, [
    socket,
    onMessage,
    onGroupMessage,
    onRecalled,
    onReceived,
    onPresence,
    onTyping,
    onGroupRoomUpdated,
    onGroupMemberLeft,
    onGroupCallStarted,
    onGroupCallEnded,
    onGroupDissolved,
    onIncomingCall,
    onCallEnd,
  ]);
}
